const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:\\Users\\muges\\Downloads\\phoenix-x\\.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const testUsernames = [];
    for (let i = 2; i <= 32; i++) testUsernames.push(`@test${i}`);

    console.log(`🔍 Fetching IDs for ${testUsernames.length} test users...`);
    const { data: users, error: uErr } = await supabase.from('profiles')
        .select('id, username')
        .in('username', testUsernames);

    if (uErr || !users) {
        console.error('❌ Failed to fetch test users:', uErr);
        return;
    }
    console.log(`✅ Found ${users.length} users.`);

    console.log('🔍 Fetching all upcoming 3min Paid Tournaments...');
    const { data: tourneys, error: tErr } = await supabase.from('tournaments')
        .select('id, name, entry_fee, current_players')
        .eq('timer_type', 3)
        .eq('status', 'upcoming');

    if (tErr || !tourneys) {
        console.error('❌ Failed to fetch tournaments:', tErr);
        return;
    }
    console.log(`✅ Found ${tourneys.length} tournaments.`);

    for (const t of tourneys) {
        console.log(`\n🏆 Processing ${t.name} (Entry: ${t.entry_fee})...`);
        
        const { data: existingPlayers } = await supabase.from('tournament_players')
            .select('user_id')
            .eq('tournament_id', t.id);
        
        const existingIds = new Set(existingPlayers?.map(p => p.user_id) || []);
        const toAdd = users.filter(u => !existingIds.has(u.id));

        if (toAdd.length === 0) {
            console.log(`⏩ Skipping ${t.name} (Test users already joined)`);
            continue;
        }

        console.log(`➕ Adding ${toAdd.length} players to ${t.name}...`);

        const inserts = toAdd.map(u => ({
            tournament_id: t.id,
            user_id: u.id,
            score: 0
        }));

        const { error: insErr } = await supabase.from('tournament_players').insert(inserts);
        if (insErr) {
            console.error(`❌ Failed to add players to ${t.name}:`, insErr.message);
        } else {
            const { data: countData } = await supabase.from('tournament_players')
                .select('id', { count: 'exact' })
                .eq('tournament_id', t.id);
            
            const finalCount = countData?.length || 0;
            await supabase.from('tournaments').update({ current_players: finalCount }).eq('id', t.id);
            console.log(`✅ ${t.name} updated to ${finalCount} players.`);
        }
    }
    console.log('\n✨ Done! You can now join any of these tournaments as the 32nd player.');
}

run();
