const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.from('tournaments')
        .select('id, name, status, start_time, end_time, timer_type')
        .eq('type', 'free')
        .order('start_time', { ascending: false })
        .limit(10);
    
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

check();
