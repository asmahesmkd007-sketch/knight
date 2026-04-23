
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function setupTestUsers() {
    console.log('🚀 Setting up 31 test users (test2 - test32)...');
    const users = [];
    for (let i = 2; i <= 32; i++) {
        const rawUsername = `test${i}`;
        const username = `@${rawUsername}`;
        const email = `${rawUsername}@example.com`;
        const password = 'TestPassword123!';
        
        // Check if profile exists
        const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
        
        let userId;
        if (!existing) {
            console.log(`Creating user ${username}...`);
            const { data: authData, error: aErr } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: `Test User ${i}` }
            });

            if (aErr) {
                // If user already exists in auth but not profile, try to find them
                if (aErr.message.includes('already registered')) {
                     const { data: authList } = await supabase.auth.admin.listUsers();
                     const found = authList.users.find(u => u.email === email);
                     if (found) userId = found.id;
                } else {
                    console.error(`Auth error for ${username}:`, aErr.message);
                    continue;
                }
            } else {
                userId = authData.user.id;
            }

            if (userId) {
                // Create profile if missing
                const { error: pErr } = await supabase.from('profiles').upsert({ 
                    id: userId, username, kyc_status: 'verified' 
                });
                if (pErr) console.error(`Profile error for ${username}:`, pErr);
                
                // Create wallet
                await supabase.from('wallets').upsert({ user_id: userId, balance: 100000 });
            }
        } else {
            userId = existing.id;
            // Ensure balance and kyc
            await supabase.from('wallets').update({ balance: 100000 }).eq('user_id', userId);
            await supabase.from('profiles').update({ kyc_status: 'verified' }).eq('id', userId);
        }
        if (userId) users.push(userId);
    }
    return users;
}

async function fillTournaments(userIds) {
    console.log('🏆 Filling all 3min Paid TRs to 31/32 players...');
    
    // Get all upcoming 3min paid TRs
    const { data: tournaments } = await supabase.from('tournaments')
        .select('id, name, max_players')
        .eq('type', 'paid')
        .eq('timer_type', 3)
        .eq('status', 'upcoming');

    if (!tournaments || tournaments.length === 0) {
        console.log('❌ No upcoming 3min paid tournaments found.');
        return;
    }

    for (const t of tournaments) {
        console.log(`📍 Filling ${t.name} (ID: ${t.id})...`);
        
        // Clear current players for a clean test if needed, or just add missing
        await supabase.from('tournament_players').delete().eq('tournament_id', t.id);
        
        const participants = userIds.map(uid => ({
            tournament_id: t.id,
            user_id: uid,
            status: 'active',
            score: 0
        }));

        const { error: insErr } = await supabase.from('tournament_players').insert(participants);
        if (insErr) {
            console.error(`Error filling ${t.name}:`, insErr);
        } else {
            // Update tournament count
            await supabase.from('tournaments').update({ current_players: 31 }).eq('id', t.id);
            console.log(`✅ ${t.name} is now at 31/32 players.`);
        }
    }
}

async function run() {
    try {
        const userIds = await setupTestUsers();
        if (userIds.length > 0) {
            await fillTournaments(userIds);
        }
        console.log('\n✨ DONE! All 3min Paid TRs are ready for you to join as the 32nd player.');
    } catch (e) {
        console.error('Fatal error:', e);
    }
}

run();
