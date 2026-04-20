require('dotenv').config();
const { supabase } = require('../backend/config/supabase');

async function addTestPlayers() {
    const usernames = [
        '@ma_hes', '@m_radha', '@mana_ansn', '@player6540', '@new_new',
        '@new_nrw', '@new_mew', '@nnan_nana', '@phoenix_brothers', '@phoenix_tamilyt',
        '@phoenix_tamil', '@santha_arun', '@phoenix', '@testing', '@mage'
    ];

    console.log('🔍 Fetching User IDs...');
    const { data: profiles, error: pErr } = await supabase.from('profiles')
        .select('id, username')
        .in('username', usernames);
    
    if (pErr || !profiles) {
        console.error('❌ Failed to fetch profiles:', pErr);
        return;
    }

    console.log(`✅ Found ${profiles.length} profiles.`);

    console.log('🔍 Fetching Upcoming 1min Paid Tournaments...');
    const { data: tourneys, error: tErr } = await supabase.from('tournaments')
        .select('id, tr_id, current_players')
        .eq('type', 'paid')
        .eq('timer_type', 1)
        .eq('status', 'upcoming');

    if (tErr || !tourneys) {
        console.error('❌ Failed to fetch tournaments:', tErr);
        return;
    }

    console.log(`✅ Found ${tourneys.length} tournaments.`);

    for (const t of tourneys) {
        console.log(`🏃 Processing ${t.tr_id}...`);
        
        const playersToAdd = profiles.map(p => ({
            tournament_id: t.id,
            user_id: p.id,
            score: 0
        }));

        const { error: insErr } = await supabase.from('tournament_players').insert(playersToAdd);
        if (insErr) {
            if (insErr.code === '23505') {
                console.log(`⚠️ Players already in ${t.tr_id}, skipping insert.`);
            } else {
                console.error(`❌ Insert error for ${t.tr_id}:`, insErr);
                continue;
            }
        }

        // Update count
        const { count } = await supabase.from('tournament_players')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', t.id);
        
        await supabase.from('tournaments').update({ current_players: count }).eq('id', t.id);
        console.log(`✨ ${t.tr_id} now has ${count} players.`);
    }

    console.log('🎉 Done!');
}

addTestPlayers();
