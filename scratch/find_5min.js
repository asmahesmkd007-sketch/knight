const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:\\Users\\muges\\Downloads\\phoenix-x\\backend\\.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data: upcoming } = await supabase.from('tournaments')
        .select('id, name, status, timer_type')
        .eq('timer_type', 5)
        .in('status', ['upcoming', 'starting', 'live']);
    
    console.log('Upcoming/Live 5min Tournaments:', upcoming);
}

check();
