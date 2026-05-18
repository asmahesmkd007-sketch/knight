// CHESS OX Backend - Stability Patch v2 - 2026-05-12
require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const compression = require('compression');
const path       = require('path');
const rateLimit = require('express-rate-limit');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { 
    origin: (origin, callback) => {
      const allowed = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
      if (!origin || allowed.indexOf(origin) !== -1 || origin.includes('vercel.app') || origin.includes('localhost') || origin.includes('onrender.com')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 10000, 
  pingInterval: 5000, 
});

app.set('io', io);

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use((req, res, next) => {
  // Only log API requests — skip static file noise
  if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [process.env.FRONTEND_URL || 'http://localhost:3000'];

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('vercel.app') || origin.includes('localhost') || origin.includes('onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

app.use('/api/auth',        require('./routes/auth.routes'));
app.use('/api/user',        require('./routes/user.routes').userRouter);
app.use('/api/wallet',      require('./routes/wallet.routes'));
app.use('/api/tournaments', require('./routes/tournament.routes'));
app.use('/api/game',        require('./routes/game.routes').gameRouter);
app.use('/api/records',     require('./routes/records.routes'));
app.use('/api/friends',     require('./routes/friend.routes'));
app.use('/api/kyc',         require('./routes/kyc.routes'));
app.use('/api/clans',       require('./routes/clan.routes'));
app.use('/api/rooms',       require('./routes/room.routes'));

// ─── HEALTH CHECK (Sanitized) ─────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ─── SOCKET.IO ────────────────────────────────────────────
require(path.join(__dirname, './socket/socket'))(io);

// ─── LOBBY SERVICES ───────────────────────────────────────
const RoomManager = require('./services/room.manager');
RoomManager.init(io);

// ─── SCHEDULERS ───────────────────────────────────────────
const { updateTournamentStatuses } = require('./controllers/tournament.controller');

// Update tournament statuses every 30 seconds
setInterval(updateTournamentStatuses, 30 * 1000);

// ─── API 404 HANDLER ──────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ─── STATIC FRONTEND ──────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve login page as default for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});

// ─── START ───────────────────────────────────────────────
const requiredEnv = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET',
  'JWT_SECRET'
];

requiredEnv.forEach(env => {
  if (!process.env[env]) {
    console.error(`❌ CRITICAL ERROR: Environment variable ${env} is missing!`);
    process.exit(1);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ♔  CHESS OX — Online Chess Platform');
  console.log('  ─────────────────────────────────────');
  console.log(`  🚀  Server   : http://localhost:${PORT}`);
  console.log(`  🗄  Database : Supabase (PostgreSQL)`);
  console.log(`  🔌  Socket   : Socket.IO ready`);
  console.log('');
});

module.exports = { app, io };
