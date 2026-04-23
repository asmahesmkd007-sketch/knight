
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSchema() {
    console.log('🔍 Checking tournaments table schema...');
    const { data, error } = await supabase.rpc('exec_sql', { 
        sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'tournaments';" 
    });

    if (error) {
        console.error('Error fetching schema:', error);
        return;
    }

    const columns = data.map(c => c.column_name);
    console.log('✅ Columns in tournaments table:', columns);
    
    if (columns.includes('prize_metadata')) {
        console.log('🎉 prize_metadata column FOUND!');
    } else {
        console.log('❌ prize_metadata column MISSING!');
    }
}

checkSchema();
