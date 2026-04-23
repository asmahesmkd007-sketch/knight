
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkTournaments() {
    console.log('🔍 Checking for 3-minute tournaments...');
    const { data, error } = await supabase.from('tournaments')
        .select('tr_id, name, timer_type, entry_fee, status, max_players')
        .eq('type', 'paid')
        .eq('timer_type', 3)
        .eq('status', 'upcoming')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching tournaments:', error);
        return;
    }

    if (data.length === 0) {
        console.log('⚠️ No upcoming 3-minute tournaments found. Triggering auto-creation...');
        const { autoCreatePaidTournaments } = require('../backend/controllers/tournament.controller');
        await autoCreatePaidTournaments();
        console.log('✅ Auto-creation triggered. Run script again in a second.');
    } else {
        console.log(`✅ Found ${data.length} upcoming 3-minute tournaments:`);
        data.forEach(t => {
            console.log(`- [${t.status}] ${t.tr_id}: ${t.name} (${t.max_players} players)`);
        });
    }
}

checkTournaments();
