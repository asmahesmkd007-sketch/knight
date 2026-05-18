const API_BASE = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api` : 'http://localhost:5000/api';

const getSession = () => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('px_token');
  const user = localStorage.getItem('px_user') ? JSON.parse(localStorage.getItem('px_user')) : null;
  return { token, user };
};

export const api = async (endpoint, options = {}) => {
  const { token } = getSession();
  
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

    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        window.location.href = '/login';
      }
      return { success: false, message: 'Session expired' };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    return { success: false, message: 'Network error' };
  }
};

export const AuthAPI = {
  login: (data) => api('/auth/login', { method: 'POST', body: data }),
  register: (data) => api('/auth/register', { method: 'POST', body: data }),
  me: () => api('/auth/me'),
};

export const UserAPI = {
  getProfile: () => api('/user/profile'),
  getStats: () => api('/user/stats'),
  getNotifications: () => api('/user/notifications'),
};

export const WalletAPI = {
  getBalance: () => api('/wallet/balance'),
  getTransactions: (page = 1) => api(`/wallet/transactions?page=${page}`),
};

export const GameAPI = {
  getHistory: (filter = 'all', category = 'all', page = 1) => 
    api(`/game/history?filter=${filter}&category=${category}&page=${page}`),
  getLeaderboard: (page = 1, sort = 'iq') => 
    api(`/game/leaderboard?page=${page}&sort=${sort}`),
};

export const TournamentAPI = {
  getAll: (type, status) => 
    api(`/tournaments?${type ? 'type=' + type : ''}${status ? '&status=' + status : ''}`),
};

export const FriendAPI = {
  getChallenges: () => api('/friends/challenges'),
};
