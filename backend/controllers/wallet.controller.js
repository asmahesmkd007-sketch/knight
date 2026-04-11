const { supabase } = require('../config/supabase');
const { createOrder, verifyPaymentSignature } = require('../config/razorpay');

const getWallet = async (req, res) => {
  try {
    const { data, error } = await supabase.from('wallets').select('*').eq('user_id', req.user.id).single();
    if (error) return res.status(404).json({ success: false, message: 'Wallet not found.' });
    res.json({ success: true, wallet: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createDepositOrder = async (req, res) => {
  try {
    if (req.user.kyc_status !== 'verified') return res.status(403).json({ success: false, message: 'KYC required to use wallet.' });
    const { amount } = req.body;
    if (!amount || amount < 10) return res.status(400).json({ success: false, message: 'Minimum deposit is ₹10.' });

    const order = await createOrder(amount);

    // Save pending transaction
    await supabase.from('transactions').insert({
      user_id: req.user.id, type: 'deposit', amount,
      status: 'pending', razorpay_order_id: order.id,
    });

    res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('Deposit order error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment order.' });
  }
};

const verifyDeposit = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) return res.status(400).json({ success: false, message: 'Payment verification failed.' });

    // Find pending transaction
    const { data: txn } = await supabase.from('transactions').select('*').eq('razorpay_order_id', razorpay_order_id).eq('status', 'pending').maybeSingle();
    if (!txn) return res.status(400).json({ success: false, message: 'Transaction not found.' });

    // Credit wallet
    const { data: wallet } = await supabase.from('wallets').select('balance, total_deposited').eq('user_id', txn.user_id).single();
    const newBalance = Number(wallet.balance) + Number(txn.amount);
    await supabase.from('wallets').update({ balance: newBalance, total_deposited: Number(wallet.total_deposited) + Number(txn.amount) }).eq('user_id', txn.user_id);

    // Update transaction
    await supabase.from('transactions').update({ status: 'success', razorpay_payment_id, balance_after: newBalance }).eq('id', txn.id);

    // Notification
    await supabase.from('notifications').insert({ user_id: txn.user_id, type: 'deposit', title: 'Deposit Successful ✅', message: `₹${txn.amount} credited to your wallet as ${txn.amount} coins.` });

    res.json({ success: true, message: 'Coins added!', balance: newBalance });
  } catch (err) {
    console.error('Verify deposit error:', err);
    res.status(500).json({ success: false, message: 'Verification error.' });
  }
};

const requestWithdraw = async (req, res) => {
  try {
    if (req.user.kyc_status !== 'verified') 
      return res.status(403).json({ success: false, message: 'KYC required.' });
    
    const { amount } = req.body;
    if (!amount || amount < 30) 
      return res.status(400).json({ success: false, message: 'Minimum 30 coins.' });

    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance, total_withdrawn')
      .eq('user_id', req.user.id)
      .single();

    if (!wallet || Number(wallet.balance) < amount)
      return res.status(400).json({ success: false, message: 'Insufficient balance.' });
    
    if (Number(wallet.balance) - amount < 10)
      return res.status(400).json({ success: false, message: 'Must keep minimum 10 coins.' });

    const newBalance = Number(wallet.balance) - amount;
    const newWithdrawn = Number(wallet.total_withdrawn || 0) + amount;

    // Balance deduct பண்ணு
    await supabase
      .from('wallets')
      .update({ 
        balance: newBalance,
        total_withdrawn: newWithdrawn
      })
      .eq('user_id', req.user.id);

    // Queue position
    const { count } = await supabase
      .from('withdraw_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    const queuePos = (count || 0) + 1;

    // Withdraw request create
    const { data: wr } = await supabase
      .from('withdraw_requests')
      .insert({ 
        user_id: req.user.id, 
        amount, 
        queue_position: queuePos 
      })
      .select()
      .single();

    // Transaction record
    await supabase.from('transactions').insert({ 
      user_id: req.user.id, 
      type: 'withdraw', 
      amount, 
      status: 'pending', 
      reference_id: wr.id, 
      balance_after: newBalance 
    });

    // Notification
    await supabase.from('notifications').insert({ 
      user_id: req.user.id, 
      type: 'withdraw', 
      title: 'Withdrawal Requested', 
      message: `${amount} coins withdrawal pending. Queue: #${queuePos}` 
    });

    res.json({ success: true, message: 'Request submitted!', queue_position: queuePos, new_balance: newBalance });
  } catch (err) {
    console.error('Withdraw error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    let query = supabase.from('transactions').select('*', { count: 'exact' }).eq('user_id', req.user.id).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (type && type !== 'all') query = query.eq('type', type);
    const { data, count } = await query;
    res.json({ success: true, transactions: data || [], total: count, pages: Math.ceil((count || 0) / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getWallet, createDepositOrder, verifyDeposit, requestWithdraw, getTransactions };
