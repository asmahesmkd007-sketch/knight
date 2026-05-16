const API_BASE = (window.location.port === '5500' || window.location.port === '3000') 
  ? 'http://localhost:5000/api' 
  : '/api';

// ─── DYNAMIC CONFIG ───────────────────────────────────────
let CONFIG = { supabase: { url: '', anon_key: '' } };
let sbClient = null;

const fetchConfig = async () => {
  if (CONFIG.supabase.url) return CONFIG;
  try {
    const res = await fetch(`${API_BASE}/auth/config`);
    const data = await res.json();
    if (data.success) {
      CONFIG = data;
      if (window.supabase) {
        sbClient = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anon_key);
      }
      return CONFIG;
    }
  } catch (err) {
    console.error('Failed to fetch config:', err);
  }
  return null;
};

// ─── THEME INIT (runs before anything else to prevent flash) ──
(function() {
  try {
    const u = JSON.parse(localStorage.getItem('px_user'));
    const theme = u?.settings?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch {}
})();

// ─── FORMAT HELPERS ───────────────────────────────────────
const fmt = {
  username: (name) => name ? (name.startsWith('@') ? name : '@' + name) : '',
  coins   : (n) => `${Number(n||0).toLocaleString()} <i class="fa-solid fa-coins"></i>`,
  inr     : (n) => `₹${Number(n||0).toLocaleString()}`,
  time    : (d) => new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }),
  relTime : (d) => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  },
  countdown: (t) => {
    if (!t || t < 0 || isNaN(t) || t > 360000) return '0:00';
    const m = Math.floor(t/60), s = t%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  },
  rankClass: (rank) => ({ 
    Bronze: 'badge-bronze', 
    Copil: 'badge-copil', 
    Silver: 'badge-silver', 
    Gold: 'badge-gold', 
    Platinum: 'badge-platinum', 
    Diamond: 'badge-diamond', 
    Kingdom: 'badge-kingdom', 
    'Grand Master': 'badge-grandmaster' 
  }[rank] || 'badge-bronze'),
};

// ─── SESSION HELPERS ─────────────────────────────────────
var getToken        = () => localStorage.getItem('px_token');
var getRefreshToken = () => localStorage.getItem('px_refresh');
var getUser         = () => { try { return JSON.parse(localStorage.getItem('px_user')); } catch { return null; } };
var isLoggedIn      = () => !!getToken();

// Export to window for global access
window.getToken = getToken;
window.getUser = getUser;
window.isLoggedIn = isLoggedIn;
window.setSession = (token, refresh, user) => {
  if (token) localStorage.setItem('px_token', token);
  if (refresh) localStorage.setItem('px_refresh', refresh);
  if (user) localStorage.setItem('px_user', JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem('px_token');
  localStorage.removeItem('px_refresh');
  localStorage.removeItem('px_user');
};
window.clearSession = clearSession;

let _refreshing = false;

const api = async (endpoint, options = {}, retry = true) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Token expired → try refresh once
    const isAuthRoute = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register') || endpoint.startsWith('/user/change-password');
    if (res.status === 401 && retry && !_refreshing && !isAuthRoute) {
      _refreshing = true;
      const refreshed = await tryRefreshToken();
      _refreshing = false;
      if (refreshed) return api(endpoint, options, false);
      
      // Prevent redirect if we're in the middle of a password change or other sensitive operation
      if (window._isSettingPassword) {
        console.warn('Blocking 401 redirect during sensitive operation');
        return { success: false, message: 'Session expired, please wait...' };
      }

      clearSession();
      window.location.href = '/pages/login.html';
      return;
    }

    const data = await res.json();
    
    // Auto-update session if new tokens are returned in any successful response
    if (data?.success && data?.token) {
      setSession(data.token, data.refresh_token, data.user || getUser());
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    return { success: false, message: 'Network error. Check connection.' };
  }
};

const tryRefreshToken = async () => {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('px_token', data.token);
      localStorage.setItem('px_refresh', data.refresh_token);
      return true;
    }
    return false;
  } catch { return false; }
};

// ─── AUTH API ────────────────────────────────────────────
var AuthAPI = {
  register    : (d) => api('/auth/register',      { method: 'POST', body: d }),
  login       : (d) => api('/auth/login',          { method: 'POST', body: d }),
  oauthLogin  : (d) => api('/auth/oauth-login',   { method: 'POST', body: d }),
  logout      : async () => {
    try { await api('/auth/logout', { method: 'POST' }, false); } catch {}
    clearSession();
    window.location.href = '/pages/login.html';
  },
  me          : ()  => api('/auth/me'),
};

// ─── USER API ────────────────────────────────────────────
var UserAPI = {
  getProfile     : ()  => api('/user/profile'),
  updateProfile  : (d) => api('/user/profile',        { method: 'PUT',  body: d }),
  changePassword : (d) => api('/user/change-password', { method: 'POST', body: d }),
  updateSettings : (s) => api('/user/settings',        { method: 'PUT',  body: { settings: s } }),
  getNotifications: () => api('/user/notifications'),
  markNotificationsRead: () => api('/user/notifications/read', { method: 'PUT' }),
  getStats       : ()  => api('/user/stats'),
  uploadAvatar   : (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    const token = getToken();
    return fetch(`${API_BASE}/user/avatar`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd
    }).then(res => res.json());
  },
  submitReport   : (d) => api('/user/report', { method: 'POST', body: d }),
  submitFeedback : (d) => api('/user/feedback', { method: 'POST', body: d }),
  savePayoutDetails: (d) => api('/user/payout-details', { method: 'PUT', body: d }),
};

// ─── WALLET API ──────────────────────────────────────────
var WalletAPI = {
  getBalance        : ()   => api('/wallet/balance'),
  createDepositOrder: (amt)=> api('/wallet/deposit/order', { method: 'POST', body: { amount: amt } }),
  verifyDeposit     : (d)  => api('/wallet/deposit/verify', { method: 'POST', body: d }),
  requestWithdraw   : (amt, upi)=> api('/wallet/withdraw', { method: 'POST', body: { amount: amt, upi_id: upi } }),
  getTransactions   : (page=1) => api(`/wallet/transactions?page=${page}`),
};

// ─── GAME API ────────────────────────────────────────────
const GameAPI = {
  getHistory    : (filter='all', category='all', page=1) => api(`/game/history?filter=${filter}&category=${category}&page=${page}`),
  getLeaderboard: (page=1, sort='iq')    => api(`/game/leaderboard?page=${page}&sort=${sort}`),
  getMatch      : (id)                   => api(`/game/match/${id}`),
  saveBotMatch  : (result, fen)          => api('/game/bot-match', { method: 'POST', body: { result, fen } }),
};

// ─── TOURNAMENT API ──────────────────────────────────────
var TournamentAPI = {
  getAll      : (type, status) => api(`/tournaments?${type?'type='+type:''}${status?'&status='+status:''}`),
  getById     : (id)           => api(`/tournaments/${id}`),
  join        : (id)           => api(`/tournaments/${id}/join`, { method: 'POST' }),
  getLeaderboard: (id)         => api(`/tournaments/${id}/leaderboard`),
};

// ─── ROOM API ─────────────────────────────────────────────
const RoomAPI = {
  create: (timerType) => api('/rooms/create', { method: 'POST', body: { timerType } }),
  getByCode: (code)  => api(`/rooms/code/${code}`),
};

// ─── RECORDS API ───────────────────────────────────────────
const RecordsAPI = {
  getDashboard   : ()              => api('/records/dashboard'),
  getUsers       : (params='')     => api(`/records/users?${params}`),
  updateUserStatus:(id, status)    => api(`/records/users/${id}/status`,  { method: 'PUT',  body: { status } }),
  getKYC         : ()              => KYCAPI.getAdminList(),
  reviewKYC      : (requestId, status, reason) => KYCAPI.review({ requestId, status, reason }),
  getWithdrawals : ()              => api('/records/withdrawals'),
  processWithdraw: (id, action, reason) => api(`/records/withdrawals/${id}`, { method: 'PUT', body: { action, rejection_reason: reason } }),
  createTournament:(d)             => api('/records/tournaments',         { method: 'POST', body: d }),
  getAllTournaments: ()            => api('/records/tournaments'),
  getTournamentDetails: (id)        => api(`/records/tournaments/${id}/details`),
  cancelTournament: (id)           => api(`/records/tournaments/${id}/cancel`, { method: 'PUT' }),
  getLiveMatches : ()              => api('/records/matches/live'),
  getTransactions: (type, page=1) => api(`/records/transactions?type=${type}&page=${page}`),
  getReports     : ()              => api('/records/reports'),
  updateReportStatus: (id, status) => api(`/records/reports/${id}`, { method: 'PUT', body: { status } }),
  getFeedbacks   : ()              => api('/records/feedbacks'),
};

// ─── FRIEND API ──────────────────────────────────────────
const FriendAPI = {
  getFriends    : () => api('/friends'),
  removeFriend  : (id) => api(`/friends/${id}`, { method: 'DELETE' }),
  sendRequest   : (username) => api('/friends/request', { method: 'POST', body: { targetUsername: username } }),
  getRequests   : () => api('/friends/requests'),
  respondRequest: (id, action) => api('/friends/requests', { method: 'PUT', body: { id, action } }),
  getChallenges: () => api('/friends/challenges'),
  respondChallenge: (id, action) => api('/friends/challenges', { method: 'PUT', body: { id, action } }),
};

// ─── CLAN API ────────────────────────────────────────────
const ClanAPI = {
  // Clan management
  create         : (d)          => api('/clans',                    { method: 'POST', body: d }),
  getMyClan      : ()           => api('/clans/me'),
  getById        : (id)         => api(`/clans/${id}`),
  search         : (q='')       => api(`/clans/search?q=${encodeURIComponent(q)}`),
  join           : (id)         => api(`/clans/${id}/join`,         { method: 'POST' }),
  leave          : ()           => api('/clans/leave',              { method: 'POST' }),
  updateRole     : (d)          => api('/clans/members/role',       { method: 'PUT',  body: d }),
  kickMember     : (userId)     => api(`/clans/members/${userId}`,  { method: 'DELETE' }),
  getLeaderboard : ()           => api('/clans/leaderboard'),
  getJoinRequests: ()           => api('/clans/requests'),
  respondJoinRequest: (d)       => api('/clans/requests/respond',   { method: 'POST', body: d }),
  delete         : ()          => api('/clans',                    { method: 'DELETE' }),
  transferLeadership: (targetUserId) => api('/clans/transfer-leadership', { method: 'PUT', body: { targetUserId } }),
  inviteMember   : (username)   => api('/clans/invite',             { method: 'POST', body: { targetUsername: username } }),
  getMyInvitations: ()          => api('/clans/my-invitations'),
  respondInvitation: (id, action) => api('/clans/respond-invitation', { method: 'POST', body: { inviteId: id, action } }),
  // War management
  declareWar     : (targetClanId) => api('/clans/wars/declare',     { method: 'POST', body: { targetClanId } }),
  acceptWar      : (warId)      => api(`/clans/wars/${warId}/accept`, { method: 'PUT' }),
  setLineup      : (d)          => api('/clans/wars/lineup',        { method: 'POST', body: d }),
  getMyWar       : ()           => api('/clans/wars/me'),
  getPendingWars : ()           => api('/clans/wars/pending'),
  getWarHistory  : ()           => api('/clans/wars/history'),
  getWarDetails  : (warId)      => api(`/clans/wars/${warId}`),
};

// ─── KYC API ─────────────────────────────────────────────
const KYCAPI = {
  submit: (formData) => {
    const token = getToken();
    return fetch(`${API_BASE}/kyc/submit`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData 
    }).then(res => res.json());
  },
  getAdminList: () => api('/kyc/records/list'),
  review: (data) => api('/kyc/records/review', { method: 'POST', body: data })
};

// ─── TOAST ───────────────────────────────────────────────
const Toast = {
  _container: null,
  _getContainer() {
    if (!this._container) {
      this._container = document.getElementById('toast-container');
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.id = 'toast-container';
        this._container.className = 'toast-container';
        document.body.appendChild(this._container);
      }
    }
    return this._container;
  },
  show(message, type = 'info', duration = 3500) {
    const c = this._getContainer();
    const icons = { success: '<i class="fa-solid fa-check"></i>', error: '<i class="fa-solid fa-xmark"></i>', info: '<i class="fa-solid fa-info-circle"></i>', warning: '<i class="fa-solid fa-triangle-exclamation"></i>' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    c.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toast-in 0.3s ease reverse forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },
  success: (m) => Toast.show(m, 'success'),
  error  : (m) => Toast.show(m, 'error'),
  info   : (m) => Toast.show(m, 'info'),
  warning: (m) => Toast.show(m, 'warning'),
};

// ─── GUARDS ──────────────────────────────────────────────
var requireAuth  = () => { if (!isLoggedIn()) { window.location.href = '/pages/login.html'; return false; } return true; };
window.requireAuth = requireAuth;
const requireGuest = () => { if (isLoggedIn())  { window.location.href = '/pages/dashboard.html'; return false; } return true; };

// Sidebar loader moved to sidebar.js to prevent duplicate declarations.

// ─── PWA SERVICE WORKER ───────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // FORCE UNREGISTER OLD ONES FIRST
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for(let registration of registrations) { registration.unregister(); }
    });
    navigator.serviceWorker.register('/sw.js?v=4').catch(err => console.error('SW Register Error:', err));
  });
}

// ─── PWA INSTALL PROMPT ───────────────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallPrompt();
});

function showInstallPrompt() {
  if (localStorage.getItem('pwa_installed')) return;
  
  const modal = document.createElement('div');
  modal.id = 'pwa-modal';
  modal.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.95);backdrop-filter:blur(15px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="position:relative;background:linear-gradient(145deg, #1e293b, #0f172a);border:2px solid #e8c547;border-radius:32px;padding:48px 32px 40px;max-width:380px;width:100%;text-align:center;box-shadow:0 30px 70px rgba(0,0,0,0.9);animation:pwa-pop 0.5s cubic-bezier(0.34,1.56,0.64,1);">
        <button id="pwa-close" title="Close" style="position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#94a3b8;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;">&times;</button>
        <div style="width:100px;height:100px;background:white;border-radius:28px;margin:0 auto 28px;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(232,197,71,0.5);">
          <img src="/assets/images/pwa-icon.png" style="width:100%;height:100%;border-radius:28px;object-fit:cover;">
        </div>
        <h2 style="color:#e8c547;font-family:serif;font-size:28px;margin-bottom:16px;letter-spacing:1.5px;font-weight:900;">CHESS OX</h2>
        <p style="color:#e2e8f0;font-size:16px;line-height:1.6;margin-bottom:36px;font-weight:500;">Please add CHESS OX to your Home Screen to continue. This ensures a faster and better experience.</p>
        <button id="pwa-install" style="width:100%;padding:18px;background:#e8c547;border:none;color:#0a1628;border-radius:18px;font-size:18px;font-weight:900;cursor:pointer;box-shadow:0 10px 25px rgba(232,197,71,0.4);transition:all 0.2s;">OK / INSTALL</button>
      </div>
    </div>
    <style>
      @keyframes pwa-pop { from { opacity:0; transform:scale(0.8) translateY(20px); } to { opacity:1; transform:scale(1) translateY(0); } }
      #pwa-install:hover { background: #f6e05e; transform: translateY(-2px); }
      #pwa-install:active { transform: scale(0.97); }
      #pwa-close:hover { background: rgba(255,255,255,0.15); color: #e2e8f0; }
    </style>
  `;
  document.body.appendChild(modal);

  document.getElementById('pwa-close').addEventListener('click', () => {
    modal.remove();
  });

  document.getElementById('pwa-install').addEventListener('click', async () => {
    const btn = document.getElementById('pwa-install');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('pwa_installed', 'true');
        modal.remove();
      } else {
        btn.disabled = false;
        btn.innerHTML = 'OK / INSTALL';
      }
      deferredPrompt = null;
    } else {
      modal.remove();
    }
  });
}

window.addEventListener('appinstalled', () => {
  localStorage.setItem('pwa_installed', 'true');
  const m = document.getElementById('pwa-modal');
  if (m) m.remove();
});

// ─── GOOGLE ADSENSE HELPER ────────────────────────────────
const ADSENSE_CONFIG = {
  client: 'ca-pub-1642778632018672',
  slots: {
    sidebar: 'auto',
    dashboard: 'auto',
    login: 'auto'
  }
};

function initAds() {
  // Don't load ads on critical game pages to avoid distractions
  if (window.location.pathname.includes('game.html') || window.location.pathname.includes('play.html')) return;

  // Load AdSense Script
  const script = document.createElement('script');
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CONFIG.client}`;
  script.async = true;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

// Initialize ads on load
initAds();
