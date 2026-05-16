const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://fbadrybijiwkgdfomjhp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYWRyeWJpaml3a2dkZm9tamhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0NjU1MywiZXhwIjoyMDkyNDIyNTUzfQ.7r89li1qQb02NInaJJdWkEvjH8gGZXHnKnX7ZeRgkXs'
);

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
