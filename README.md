# ♔ CHESS OX — Supabase Edition

Full-stack online chess platform. **MongoDB removed — 100% Supabase.**

---

## 🚀 Setup in 5 Steps

### Step 1 — Create Supabase Project
1. Go to **https://supabase.com** → New Project
2. Pick a name, set a strong DB password, choose region (India: `ap-south-1`)
3. Wait ~2 minutes for project to spin up

### Step 2 — Run SQL Schema
1. In Supabase dashboard → **SQL Editor** → **New Query**
2. Open `supabase_schema.sql` from this project
3. Paste the entire file → click **Run**
4. You should see: `CHESS OX Schema created successfully! 🏆`

### Step 3 — Get Your Keys
In Supabase dashboard → **Project Settings** → **API**:

| Key | Where to find |
|-----|--------------|
| `SUPABASE_URL` | Project URL (e.g. `https://abcd.supabase.co`) |
| `SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_KEY` | `service_role` `secret` key ⚠️ Keep private! |

Also get Razorpay keys from your Razorpay Dashboard → Settings → API Keys.

### Step 4 — Configure .env
```bash
cp .env.example .env
```
Edit `.env`:
```env
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...your_anon_key
SUPABASE_SERVICE_KEY=eyJhbGci...your_service_key
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
FRONTEND_URL=http://localhost:5000
```

### Step 5 — Install & Run
```bash
npm install
npm start
```
Open → **http://localhost:5000**

---

## 🛠 Make Yourself Admin

After registering your account, run this in Supabase **SQL Editor**:
```sql
UPDATE profiles
SET is_admin = true
WHERE username = 'your_username_here';
```
Then go to: **http://localhost:5000/pages/admin.html**

---

## 📁 Project Structure

```
chessox/
├── supabase_schema.sql        ← Run this first in Supabase SQL Editor
├── .env.example               ← Copy to .env, fill your keys
├── package.json
│
├── backend/
│   ├── server.js              ← Express + Socket.IO entry point
│   ├── config/
│   │   ├── supabase.js        ← Supabase client (service + anon)
│   │   └── razorpay.js        ← Razorpay payment config
│   ├── controllers/
│   │   ├── auth.controller.js       ← Supabase Auth register/login
│   │   ├── user.controller.js       ← Profile, KYC, settings
│   │   ├── wallet.controller.js     ← Deposit, withdraw, transactions
│   │   ├── tournament.controller.js ← Join, create, auto-schedule
│   │   ├── game.controller.js       ← Match history, leaderboard
│   │   └── admin.controller.js      ← Full admin controls
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── wallet.routes.js
│   │   ├── tournament.routes.js
│   │   └── game.routes.js     ← Also exports adminRouter
│   └── middleware/
│       ├── auth.middleware.js  ← Verifies Supabase JWT
│       └── admin.middleware.js ← Checks is_admin flag
│
├── socket/
│   └── socket.js              ← Matchmaking + real-time game sync
│
└── frontend/
    ├── pages/
    │   ├── login.html          ← Auth (register + login)
    │   ├── dashboard.html      ← Main hub
    │   ├── play.html           ← 4 game modes
    │   ├── game.html           ← Live chess board
    │   ├── wallet.html         ← Razorpay deposit + withdraw
    │   ├── account.html        ← Profile + KYC (Aadhaar/PAN)
    │   ├── settings.html       ← Theme, chess, privacy
    │   ├── free-tournament.html
    │   ├── paid-tournament.html
    │   ├── leaderboard.html
    │   ├── history.html
    │   └── admin.html          ← Full admin panel
    ├── components/
    │   └── sidebar.html        ← Shared nav + wallet preview
    ├── css/
    │   └── global.css          ← Full design system
    └── js/
        ├── api.js              ← All backend calls + token refresh
        └── socket.js           ← Socket.IO client helpers
```

---

## 🗄 Supabase Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends `auth.users`) |
| `wallets` | Coin balances |
| `kyc` | KYC verification documents |
| `matches` | All chess games + moves |
| `tournaments` | Tournament metadata |
| `tournament_players` | Who joined which tournament |
| `transactions` | All financial records |
| `withdraw_requests` | FIFO withdrawal queue |
| `notifications` | User alerts |

All tables have **Row Level Security (RLS)** enabled. Backend uses `service_role` key which bypasses RLS for admin operations.

---

## 📡 API Endpoints

### Auth
```
POST /api/auth/register    → Register new user (creates profile + wallet)
POST /api/auth/login       → Login, returns Supabase JWT
POST /api/auth/logout      → Mark offline
POST /api/auth/refresh     → Refresh expired token
GET  /api/auth/me          → Get current user + wallet balance
```

### User
```
GET  /api/user/profile          → Full profile
PUT  /api/user/profile          → Update username, name, phone
POST /api/user/kyc              → Submit KYC (Aadhaar/PAN)
POST /api/user/change-password  → Update password via Supabase Auth
PUT  /api/user/settings         → Save preferences
GET  /api/user/notifications    → Get + mark all as read
GET  /api/user/stats            → IQ, rank, win rate
```

### Wallet
```
GET  /api/wallet/balance               → Current balance
POST /api/wallet/deposit/create-order  → Create Razorpay order
POST /api/wallet/deposit/verify        → Verify payment + credit coins
POST /api/wallet/withdraw              → Request withdrawal
GET  /api/wallet/transactions          → Transaction history
```

### Game
```
GET /api/game/history       → Match history (filterable)
GET /api/game/leaderboard   → Global player rankings
GET /api/game/match/:id     → Single match details
```

### Tournaments
```
GET  /api/tournaments              → List (filter by type/status)
GET  /api/tournaments/:id          → Tournament + players
POST /api/tournaments/:id/join     → Join (deducts coins if paid)
GET  /api/tournaments/:id/leaderboard
```

### Admin (requires `is_admin = true`)
```
GET  /api/admin/dashboard           → Platform stats
GET  /api/admin/users               → All users
PUT  /api/admin/users/:id/status    → Block / unblock
GET  /api/admin/kyc                 → Pending KYC list
PUT  /api/admin/kyc/:id             → Approve / reject
GET  /api/admin/withdrawals         → FIFO queue
PUT  /api/admin/withdrawals/:id     → Approve / reject + refund
POST /api/admin/tournaments         → Create tournament
GET  /api/admin/matches/live        → Active matches
GET  /api/admin/transactions        → All transactions
```

---

## 🔌 Socket.IO Events

### Client → Server
| Event | Payload |
|-------|---------|
| `authenticate` | `{ userId, username }` |
| `find_match` | `{ timer, userId, username }` |
| `cancel_search` | `{ timer, userId }` |
| `make_move` | `{ matchId, move, userId }` |
| `resign` | `{ matchId, userId }` |
| `offer_draw` | `{ matchId, userId }` |
| `accept_draw` | `{ matchId }` |
| `invite_friend` | `{ targetUserId, fromUserId, fromUsername, timer }` |
| `accept_invite` | `{ fromUserId, toUserId, fromUsername, toUsername, timer }` |
| `reject_invite` | `{ fromUserId }` |
| `create_room` | `{ roomId, userId, username }` |
| `join_room` | `{ roomId, userId, username, timer }` |

### Server → Client
| Event | Payload |
|-------|---------|
| `match_found` | `{ matchId, color, opponent, timer }` |
| `move_made` | `{ move, fen, turn, pgn }` |
| `timer_update` | `{ white_time, black_time }` |
| `game_over` | `{ result, winnerId, reason, fen }` |
| `live_info` | `{ online_users, active_matches }` |
| `friend_invite` | `{ fromUserId, fromUsername, timer }` |
| `draw_offered` | — |

---

## 💳 Payment Flow (Razorpay)

```
User clicks "Add Money" (₹100)
  → POST /api/wallet/deposit/create-order  → Razorpay order created
  → Razorpay checkout overlay opens in browser
  → User pays via UPI / Card / NetBanking
  → POST /api/wallet/deposit/verify        → Signature verified
  → Supabase wallet.balance += 100
  → Transaction saved as "success"
  → Notification sent to user
```

---

## 🏆 Free Tournament Auto-Scheduler

Every **20 minutes** the server auto-creates 4 free tournaments:
- 1 min bullet
- 3 min blitz
- 5 min rapid
- 10 min classical

Each runs for **30 minutes** then auto-completes.

---

## 🚀 Production Deployment

```bash
# Use PM2 for process management
npm install -g pm2
pm2 start backend/server.js --name chessox
pm2 save
pm2 startup

# Environment variables in production
# Set them in your hosting platform (Railway, Render, Heroku, etc.)
```

**Recommended hosting:** Railway.app or Render.com (free tier available)

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| Backend | Node.js + Express |
| Real-time | Socket.IO |
| Chess | chess.js + chessboard.js |
| Payments | Razorpay |
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Fonts | Orbitron + Exo 2 |

---

Built with ♔ — CHESS OX Team
