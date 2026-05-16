let _socket = null;

const initSocket = () => {
  if (_socket && _socket.connected) return _socket;

  const socketUrl = (window.location.port === '5500' || window.location.port === '3000')
    ? 'http://localhost:5000'
    : window.location.origin;

  _socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity, // Never give up reconnecting
    reconnectionDelay: 1000,        // Reconnect faster
    reconnectionDelayMax: 5000,     // Cap the delay
    timeout: 10000                  // Detect drop faster
  });

  _socket.on('connect', () => {
    const user = getUser();
    if (user) {
      _socket.emit('authenticate', { userId: user.id, username: user.username });
    }
  });

  _socket.on('live_info', (data) => {
    if (!data) return; // Keep last known values if data is missing
    const { online_users, active_matches } = data;
    
    // Only update if we actually got numbers (ignore temporary 0s if they feel like flickering)
    document.querySelectorAll('[data-live="online"]').forEach(el => {
       if (online_users !== undefined) el.textContent = online_users.toLocaleString();
    });
    document.querySelectorAll('[data-live="matches"]').forEach(el => {
       if (active_matches !== undefined) el.textContent = active_matches.toLocaleString();
    });
  });

  _socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
  _socket.on('connect_error', (e) => console.warn('Socket error:', e.message));

  _socket.on('auth_error', async (data) => {
      alert(data.message || 'Authentication Error. Security strictly enforces a single device.');
      // Force logout from the blocked device
      try { await AuthAPI.logout(); } catch (e) {}
      localStorage.clear();
      window.location.href = '/pages/login.html';
  });

  // ─── REAL-TIME NOTIFICATIONS ───────────────────────────
  _socket.on('silent_notification', () => {
      const user = getUser();
      const s = user?.settings?.notifications || {};
      
      // If notifications are disabled for the relevant type, we might still update counts silently
      // but only show the toast if allowed. 
      // For generic "silent" ones, we'll show it as it usually means a direct system alert.
      if (typeof Toast !== 'undefined') Toast.info('New notification received! <i class="fa-solid fa-bell"></i>');
      
      // Update notification counts globally if they exist on page
      const countEl = document.getElementById('notif-count');
      if (countEl) {
          let count = parseInt(countEl.textContent) || 0;
          countEl.textContent = count + 1;
          countEl.style.display = 'flex';
      }
      // Only call page-specific reload functions if they exist on this page
      if (typeof loadDashboardData === 'function') loadDashboardData();
      if (typeof loadRequests === 'function') loadRequests();
  });

  _socket.on('friend_invite', (data) => {
      const user = getUser();
      const s = user?.settings || {};
      const notifs = s.notifications || {};
      
      if (notifs.friend_request === false) return;

      if (s.challenge_mode === 'auto_reject') {
          _socket.emit('reject_invite', { fromUserId: data.fromUserId });
          return;
      }

      if (typeof Toast !== 'undefined') {
          Toast.info(`<i class="fa-solid fa-chess-pawn"></i> New Challenge from ${data.fromUsername}! <br> <a href="/pages/friends.html" style="color:var(--gold);text-decoration:underline">Go to Social page to accept</a>`, 8000);
      }

      // Update social page list instantly if open
      if (typeof loadRequests === 'function') loadRequests();
      if (typeof loadFriends === 'function') loadFriends();
  });

  _socket.on('match_found', (data) => {
      const user = getUser();
      const s = user?.settings?.notifications || {};
      
      if (s.match_found !== false && typeof Toast !== 'undefined') {
          Toast.success('Match Found! Starting game...');
      }

      // Global match detection: redirect to game page from anywhere
      if (window.location.pathname.includes('/game.html')) {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('matchId') === data.matchId) return;
      }
      
      localStorage.setItem('px_match', JSON.stringify(data));
      window.location.href = '/pages/game.html?matchId=' + data.matchId;
  });

  _socket.on('active_match_found', (data) => {
      console.log('⚡ Active match detected:', data);
      localStorage.setItem('px_active_match_data', JSON.stringify(data));
      
      // If we are on dashboard, reload data to show rejoin card
      if (typeof loadDashboardData === 'function') {
          loadDashboardData();
      }
      
      // Auto-redirect if on game page but with wrong matchId
      if (window.location.pathname.includes('/game.html') && data.match_type !== 'tournament') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('matchId') !== data.matchId) {
             window.location.href = '/pages/game.html?matchId=' + data.matchId;
          }
      }
  });

  _socket.on('game_over', (data) => {
      localStorage.removeItem('px_active_match_data');
      if (typeof loadDashboardData === 'function') loadDashboardData();
  });

  _socket.on('active_match_update', (data) => {
      const amData = JSON.parse(localStorage.getItem('px_active_match_data') || 'null');
      if (amData && amData.matchId === data.matchId) {
          console.log('⚡ Active match sync update:', data);
          const newData = { ...amData, ...data };
          localStorage.setItem('px_active_match_data', JSON.stringify(newData));
          if (typeof loadDashboardData === 'function') loadDashboardData();
      }
  });

  _socket.on('clear_active_match', () => {
      if (localStorage.getItem('px_active_match_data')) {
          console.log('🧹 Clearing stale active match data');
          localStorage.removeItem('px_active_match_data');
          if (typeof loadDashboardData === 'function') loadDashboardData();
      }
  });

  _socket.on('cw_game_over', (data) => {
      localStorage.removeItem('px_active_match_data');
      if (typeof loadDashboardData === 'function') loadDashboardData();
  });

  return _socket;
};

const getSocket = () => _socket;

// ─── SOCKET ACTION HELPERS ───────────────────────────────
const SocketActions = {
  findMatch    : (timer, username) => _socket?.emit('find_match',    { timer, username }),
  cancelSearch : (timer)           => _socket?.emit('cancel_search', { timer }),
  makeMove     : (matchId, move)   => _socket?.emit('make_move',     { matchId, move }),
  makeTrMove   : (matchId, move)   => _socket?.emit('make_tr_move',  { matchId, moveSan: move }),
  resign       : (matchId)         => _socket?.emit('resign',        { matchId }),
  offerDraw    : (matchId)         => _socket?.emit('offer_draw',    { matchId }),
  acceptDraw   : (matchId)         => _socket?.emit('accept_draw',   { matchId }),
  inviteFriend : (targetUserId, fromUsername, timer) =>
    _socket?.emit('invite_friend', { targetUserId, fromUsername, timer }),
  acceptInvite : (fromUserId, fromUsername, timer) =>
    _socket?.emit('accept_invite', { fromUserId, fromUsername, timer }),
  rejectInvite : (fromUserId)              => _socket?.emit('reject_invite', { fromUserId }),
  createRoom   : (roomId, username) => _socket?.emit('create_room',  { roomId, username }),
  joinRoom     : (roomId, username, timer) =>
    _socket?.emit('join_room', { roomId, username, timer }),
  findTournamentMatch : (tournamentId, timer) => 
    _socket?.emit('find_tournament_match', { tournamentId, timer }),
  cancelTournamentSearch : (tournamentId) => 
    _socket?.emit('cancel_tournament_search', { tournamentId }),
  
  // Public Room (Lobby) Actions
  joinPublicRoom   : (roomCode, deviceId) => _socket?.emit('join_public_room', { roomCode, deviceId }),
  leavePublicRoom  : (roomId)    => _socket?.emit('leave_public_room',  { roomId }),
  acceptPublicMatch: (roomId, targetUserId) => _socket?.emit('public_room_request_accept', { roomId, targetUserId }),
  updateRoomStatus : (roomId, status) => _socket?.emit('public_room_status_update', { roomId, status }),
  sendRoomHeartbeat: ()    => _socket?.emit('public_room_heartbeat'),
};
