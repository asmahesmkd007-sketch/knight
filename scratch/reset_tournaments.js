require('dotenv').config();
const { supabase } = require('../backend/config/supabase');
const { autoCreatePaidTournaments } = require('../backend/controllers/tournament.controller');

async function resetSystem() {
    console.log('🔄 Starting Full Tournament System Reset...');

    try {
        // 1. Delete all tournament-related data
        console.log('🗑️ Clearing tournament_players...');
        await supabase.from('tournament_players').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        console.log('🗑️ Clearing matches...');
        await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        console.log('🗑️ Clearing leaderboards...');
        await supabase.from('leaderboard').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        console.log('🗑️ Clearing tournaments...');
        await supabase.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        console.log('✅ All data cleared.');

        // 2. Re-trigger auto-creation for fresh batch
        console.log('🚀 Generating fresh Paid Tournaments...');
        await autoCreatePaidTournaments();

        console.log('✨ Reset Complete! System is clean and ready.');
    } catch (error) {
        console.error('❌ Reset Failed:', error);
    }
}

resetSystem();
