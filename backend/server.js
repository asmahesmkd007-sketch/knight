require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const compression = require('compression');
const path       = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { 
    origin: [process.env.FRONTEND_URL || 'http://localhost:5000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 10000, 
  pingInterval: 5000, 
});

app.set('io', io);

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ 
  origin: [process.env.FRONTEND_URL || 'http://localhost:5000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
  credentials: true 
}));

// ─── CASHFREE WEBHOOK ────────────────────────────────────
app.post('/api/webhook/cashfree', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const { verifyWebhookSignature, supabase } = require('./config');
    const sig = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const bodyString = req.body.toString('utf8');
    const body = JSON.parse(bodyString);

    if (verifyWebhookSignature(sig, bodyString, timestamp)) {
      console.log('✅ Cashfree webhook verified:', body.type);
      
      // Handle PAYMENT_SUCCESS
      if (body.type === 'PAYMENT_SUCCESS_WEBHOOK') {
        const orderData = body.data.order;
        const paymentData = body.data.payment;
        const orderId = orderData.order_id;

        // ATOMIC LOCK: Claim the pending transaction
        const { data: txn } = await supabase.from('transactions')
          .update({ status: 'processing', cashfree_payment_id: paymentData.cf_payment_id })
          .eq('cashfree_order_id', orderId)
          .eq('status', 'pending')
          .select()
          .maybeSingle();

        if (txn) {
          const { data: wallet } = await supabase.from('wallets').select('balance, total_deposited').eq('user_id', txn.user_id).single();
          if (wallet) {
            const newBalance = Number(wallet.balance) + Number(txn.amount);
            await supabase.from('wallets').update({ balance: newBalance, total_deposited: (Number(wallet.total_deposited) || 0) + Number(txn.amount) }).eq('user_id', txn.user_id);
            await supabase.from('transactions').update({ status: 'success', balance_after: newBalance }).eq('id', txn.id);
            
            // Notification
            const { sendNotification } = require('./services/notification.service');
            await sendNotification({ 
              user_id: txn.user_id, 
              type: 'deposit', 
              title: 'Deposit Successful ✅', 
              message: `₹${txn.amount} credited to your wallet.` 
            });
          }
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Cashfree Webhook error:', err);
    res.status(400).json({ success: false });
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth',        require('./routes/auth.routes'));
app.use('/api/user',        require('./routes/user.routes').userRouter);
app.use('/api/wallet',      require('./routes/wallet.routes'));
app.use('/api/tournaments', require('./routes/tournament.routes'));
app.use('/api/game',        require('./routes/game.routes').gameRouter);
app.use('/api/admin',       require('./routes/admin.routes'));
app.use('/api/friends',     require('./routes/friend.routes'));
app.use('/api/kyc',         require('./routes/kyc.routes'));

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', platform: 'PHOENIX X', db: 'Supabase', timestamp: new Date() });
});

// ─── SOCKET.IO ────────────────────────────────────────────
require(path.join(__dirname, './socket/socket'))(io);

// ─── STATIC FRONTEND ─────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── SCHEDULERS ───────────────────────────────────────────
const { autoCreateFreeTournaments, autoCreatePaidTournaments, updateTournamentStatuses } = require('./controllers/tournament.controller');

// Update tournament statuses every 30 seconds
setInterval(updateTournamentStatuses, 30 * 1000);

// Create initial batch on startup
setTimeout(() => {
  autoCreateFreeTournaments();
  autoCreatePaidTournaments();
}, 3000);

// ─── CATCH-ALL → SERVE FRONTEND ───────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});

// ─── START ───────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ♔  PHOENIX X — Online Chess Platform');
  console.log('  ─────────────────────────────────────');
  console.log(`  🚀  Server   : http://localhost:${PORT}`);
  console.log(`  🗄  Database : Supabase (PostgreSQL)`);
  console.log(`  🔌  Socket   : Socket.IO ready`);
  console.log(`  💳  Payment  : Cashfree configured`);
  console.log('');
});

module.exports = { app, io };
