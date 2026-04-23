require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fillTournaments() {
    console.log('🚀 Filling all 5min TRs with 99 test users...');

    // 1. Get all test users (test2 to test100)
    const { data: testProfiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, username')
        .like('username', '@test%')
        .order('username', { ascending: true });

    if (pErr) return console.error('Error fetching profiles:', pErr);

    const testUsers = testProfiles.filter(p => {
        const num = parseInt(p.username.replace('@test', ''));
        return num >= 2 && num <= 100;
    });

    console.log(`✅ Found ${testUsers.length} test users.`);

    // 2. Get all upcoming 5min TRs
    const { data: tournaments, error: tErr } = await supabase
        .from('tournaments')
        .select('id, name, max_players, current_players')
        .eq('timer_type', 5)
        .eq('status', 'upcoming');

    if (tErr) return console.error('Error fetching tournaments:', tErr);

    console.log(`✅ Found ${tournaments.length} upcoming 5min tournaments.`);

    for (const t of tournaments) {
        console.log(`\n⏳ Processing ${t.name} (${t.id})...`);
        
        // Skip if already has players (to avoid duplicates/overfill)
        if (t.current_players >= 99) {
            console.log(`   Skipping (Already has ${t.current_players} players)`);
            continue;
        }

        const needed = 99 - t.current_players;
        const usersToAdd = testUsers.slice(0, needed);

        if (usersToAdd.length === 0) continue;

        const playersToInsert = usersToAdd.map(u => ({
            tournament_id: t.id,
            user_id: u.id,
            status: 'active'
        }));

        const { error: insErr } = await supabase.from('tournament_players').insert(playersToInsert);
        if (insErr) {
            console.error(`   Error inserting players:`, insErr.message);
            continue;
        }

        // Update tournament count
        await supabase.from('tournaments').update({ current_players: 99 }).eq('id', t.id);
        console.log(`   ✅ Added ${usersToAdd.length} players. Total: 99/100`);
    }

    console.log('\n🏁 Finished filling tournaments.');
}

fillTournaments();
