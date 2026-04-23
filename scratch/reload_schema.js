
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function reloadSchema() {
    console.log('🔄 Triggering schema reload...');
    const { error } = await supabase.rpc('exec_sql', { 
        sql: "NOTIFY pgrst, 'reload schema';" 
    });
    if (error) {
        console.error('Reload error (expected if exec_sql missing):', error);
    } else {
        console.log('✅ Reload signal sent.');
    }
}

reloadSchema();
