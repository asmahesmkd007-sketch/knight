const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log('🧹 Cleaning up redundant 10000 limit Arenas...');
    
    // Delete all free tournaments with 10000 limit
    const { data, error } = await supabase.from('tournaments')
        .delete()
        .eq('type', 'free')
        .eq('max_players', 10000);
    
    if (error) console.error('❌ Delete Error:', error);
    else console.log('✅ Cleaned up 10000 limit Arenas.');

    // Also delete any completed ones older than 2 hours to keep it clean
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { error: oldErr } = await supabase.from('tournaments')
        .delete()
        .eq('type', 'free')
        .eq('status', 'completed')
        .lt('end_time', twoHoursAgo);

    if (oldErr) console.error('❌ Old Cleanup Error:', oldErr);
}

cleanup();
