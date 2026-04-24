const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
    const tables = ['profiles', 'tournaments', 'tournament_players', 'matches', 'wallets', 'transactions', 'reports', 'feedbacks', 'kyc'];
    for (const t of tables) {
        const { error } = await supabase.from(t).select('*').limit(1);
        if (error) {
            console.log(`❌ Table [${t}]: ${error.message}`);
        } else {
            console.log(`✅ Table [${t}] exists.`);
        }
    }
}

check();
