const { supabase } = require('../config/supabase');
const { createOrder, verifySignature, fetchPayment } = require('../config/razorpay');

const getWallet = async (req, res) => {
  try {
    const { data, error } = await supabase.from('wallets').select('*').eq('user_id', req.user.id).single();
    if (error) return res.status(404).json({ success: false, message: 'Wallet not found.' });
    res.json({ success: true, wallet: data });
  } catch (err) {
    console.error('[WalletController] getWallet error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createDepositOrder = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 10) return res.status(400).json({ success: false, message: 'Minimum deposit is ₹10.' });
    if (amount > 1000) return res.status(400).json({ success: false, message: 'Maximum deposit is ₹1000.' });

    if (req.user.kyc_status !== 'verified') {
        return res.status(403).json({ success: false, message: 'KYC verification required to deposit money.' });
    }

    // 1. Create a pending transaction record
    const { data: txn, error: insErr } = await supabase.from('transactions').insert({
      user_id: req.user.id,
      type: 'deposit',
      amount,
      status: 'pending',
      reference_id: `dep_init_${Date.now()}`
    }).select().single();

    if (insErr) throw insErr;

    // 2. Create Razorpay Order
    const order = await createOrder({ amount, receipt: `txn_${txn.id}` });

    res.json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      order: { id: order.id, amount: order.amount, currency: order.currency }
    });
  } catch (err) {
    console.error('Deposit order error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment order.' });
  }
};

const verifyDeposit = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // 1. Verify Signature
    const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) return res.status(400).json({ success: false, message: 'Invalid payment signature.' });

    // 2. Double check with Razorpay (Security)
    const payment = await fetchPayment(razorpay_payment_id);
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
        return res.status(400).json({ success: false, message: 'Payment not captured.' });
    }

    const amountINR = payment.amount / 100;

    // 3. Update balance and status ATOMICALLY via RPC
    const { data: result, error: rpcErr } = await supabase.rpc('credit_wallet_deposit', {
      p_user_id: req.user.id,
      p_amount: amountINR,
      p_payment_id: razorpay_payment_id,
      p_order_id: razorpay_order_id
    });

    if (rpcErr) throw rpcErr;
    if (!result.success) return res.status(400).json({ success: false, message: result.message });

    // 4. Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.id).emit('wallet_update', { balance: result.new_balance, type: 'deposit' });
    }

    res.json({ success: true, message: 'Coins credited successfully!', balance: result.new_balance });
  } catch (err) {
    console.error('Verify deposit error:', err);
    res.status(500).json({ success: false, message: 'Verification error.' });
  }
};

const requestWithdraw = async (req, res) => {
  try {
    const { amount, upi_id } = req.body;
    const numAmt = Number(amount);
    if (!numAmt || numAmt < 30) return res.status(400).json({ success: false, message: 'Minimum withdrawal ₹30.' });
    if (numAmt > 1000) return res.status(400).json({ success: false, message: 'Maximum withdrawal ₹1000.' });
    if (!upi_id) return res.status(400).json({ success: false, message: 'UPI ID is required.' });

    if (req.user.kyc_status !== 'verified') {
        return res.status(403).json({ success: false, message: 'KYC verification required for withdrawals.' });
    }

    // Atomic move to locked_balance
    const { data: result, error: rpcErr } = await supabase.rpc('lock_wallet_withdraw', {
      p_user_id: req.user.id,
      p_amount: Number(amount),
      p_upi_id: upi_id
    });

    if (rpcErr) {
        console.error('[WalletController] RPC Error:', rpcErr);
        return res.status(500).json({ success: false, message: 'Database error: ' + rpcErr.message });
    }
    if (!result || !result.success) {
        return res.status(400).json({ success: false, message: result ? result.message : 'Request failed.' });
    }

    // Emit update (balance will decrease, locked will increase)
    const io = req.app.get('io');
    if (io) {
      io.to(req.user.id).emit('wallet_update', { balance: result.new_balance, type: 'withdraw_request' });
    }

    res.json({ success: true, message: 'Withdrawal request submitted! Admin will process it within 12-24h.' });
  } catch (err) {
    console.error('[WalletController] Withdraw error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Server error.', 
        debug: err.message 
    });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { data, count } = await supabase.from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    res.json({ success: true, transactions: data || [], total: count, pages: Math.ceil((count || 0) / limit) });
  } catch (err) {
    console.error('[WalletController] getTransactions error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getWallet, createDepositOrder, verifyDeposit, requestWithdraw, getTransactions };
