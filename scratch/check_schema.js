
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSchema() {
    console.log('🔍 Listing all tables in public schema...');
    const { data, error } = await supabase.rpc('exec_sql', { 
        sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" 
    });

    if (error) {
        console.error('Error fetching tables:', error);
        return;
    }

    const tables = data.map(t => t.table_name);
    console.log('✅ Tables found:', tables);
}

checkSchema();
