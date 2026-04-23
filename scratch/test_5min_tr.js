const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function simulate() {
    console.log('🚀 Starting 100-Player 5min TR Simulation...');
    
    // 1. Find or create a 5min TR
    const { data: t, error } = await supabase.from('tournaments').insert({
        name: '100 PLAYER SIMULATION - 5 MIN',
        type: 'paid',
        timer_type: 5,
        format: 'standard',
        entry_fee: 10,
        max_players: 100,
        status: 'upcoming',
        prize_pool: 1000,
        tr_id: `SIM-5-${Date.now()}`,
        phase: 'upcoming',
        start_time: new Date(Date.now() + 120000).toISOString()
    }).select().single();

    if (error) return console.error('Create Error:', error);
    console.log(`✅ Tournament Created: ${t.id}`);

    // 2. Add 100 test players
    // Note: These UUIDs must exist in profiles if there are constraints. 
    // I'll use some existing test users or just insert if no constraints.
    const players = [];
    for (let i = 2; i <= 101; i++) {
        players.push({
            tournament_id: t.id,
            user_id: `00000000-0000-0000-0000-000000000${i.toString().padStart(3, '0')}`,
            status: 'active'
        });
    }

    // Attempting to bypass profile constraints by assuming these users exist or constraints are relaxed for TR.
    const { error: insErr } = await supabase.from('tournament_players').insert(players);
    if (insErr) {
        console.warn('Insert Error (likely missing profiles):', insErr.message);
        console.log('Falling back to 31 existing test players...');
        const players31 = [];
        for (let i = 2; i <= 32; i++) {
            players31.push({
                tournament_id: t.id,
                user_id: `00000000-0000-0000-0000-000000000${i.toString().padStart(3, '0')}`,
                status: 'active'
            });
        }
        await supabase.from('tournament_players').insert(players31);
        await supabase.from('tournaments').update({ status: 'full', current_players: 31, max_players: 32 }).eq('id', t.id);
    } else {
        console.log('✅ 100 Players Added.');
        await supabase.from('tournaments').update({ status: 'full', current_players: 100 }).eq('id', t.id);
    }

    console.log('✅ Tournament Status: FULL');
    console.log('--- Simulation Setup Complete ---');
}

simulate();
