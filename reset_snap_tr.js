require('dotenv').config({ path: './.env' });
const { supabase } = require('./backend/config/supabase');

const getNextHalfHour = (baseDate) => {
    const d = baseDate ? new Date(baseDate) : new Date();
    const m = d.getMinutes();
    if (m < 30) { d.setMinutes(30, 0, 0); }
    else { d.setHours(d.getHours() + 1); d.setMinutes(0, 0, 0); }
    return d.toISOString();
};

const getCurrentHalfHour = () => {
    const d = new Date();
    const m = d.getMinutes();
    if (m < 30) { d.setMinutes(0, 0, 0); }
    else { d.setMinutes(30, 0, 0); }
    return d.toISOString();
};

async function resetTournaments() {
  console.log('Resetting free tournaments...');

  // 1. Delete all existing free tournaments
  await supabase.from('tournaments').delete().eq('type', 'free');

  // 2. LIVE match (current exactly snapped)
  const timers = [1, 3, 5, 10];
  const liveStart = getCurrentHalfHour();
  const liveEnd = getNextHalfHour();
  
  const liveRows = timers.map(t => ({
    name: `Free ${t}min Tournament`, type: 'free', timer_type: t, status: 'live', phase: 'qualifier',
    max_players: 500, start_time: liveStart, end_time: liveEnd, duration_minutes: 30,
  }));

  // UPCOMING match
  const upStart = liveEnd;
  const upEnd = new Date(new Date(upStart).getTime() + 30 * 60 * 1000).toISOString();
  
  const upRows = timers.map(t => ({
    name: `Free ${t}min Tournament`, type: 'free', timer_type: t, status: 'upcoming',
    max_players: 500, start_time: upStart, end_time: upEnd, duration_minutes: 30,
  }));

  await supabase.from('tournaments').insert([...liveRows, ...upRows]);
  console.log('Snapped times applied successfully!');
}

resetTournaments();
