const { supabase } = require('../backend/config/supabase');

async function check() {
    const { data: upcoming } = await supabase.from('tournaments')
        .select('id, name, status, timer_type')
        .eq('timer_type', 5)
        .in('status', ['upcoming', 'starting', 'live']);
    
    console.log('Upcoming/Live 5min Tournaments:', upcoming || []);
}

check();
