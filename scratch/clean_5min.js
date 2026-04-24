const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:\\Users\\muges\\Downloads\\phoenix-x\\.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data: upcoming } = await supabase.from('tournaments')
        .select('id, name, status, timer_type')
        .eq('timer_type', 5)
        .in('status', ['upcoming', 'starting', 'live']);
    
    console.log('Upcoming/Live 5min Tournaments:', upcoming || []);
    
    if (upcoming && upcoming.length > 0) {
        console.log('Cleaning up 5min tournaments...');
        for (const t of upcoming) {
            await supabase.from('tournaments').delete().eq('id', t.id);
            console.log(`Deleted: ${t.name} (${t.id})`);
        }
    } else {
        console.log('No 5min tournaments found to delete.');
    }
}

check();
