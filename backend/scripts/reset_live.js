const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://fbadrybijiwkgdfomjhp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYWRyeWJpaml3a2dkZm9tamhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0NjU1MywiZXhwIjoyMDkyNDIyNTUzfQ.7r89li1qQb02NInaJJdWkEvjH8gGZXHnKnX7ZeRgkXs'
);

async function reset() {
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setMinutes(now.getMinutes() < 30 ? 0 : 30, 0, 0);
    currentStart.setSeconds(0, 0);
    currentStart.setMilliseconds(0);
    const startStr = currentStart.toISOString();

    console.log(`🔄 Resetting all Free Arenas starting at ${startStr} to LIVE...`);

    const { data, error } = await supabase.from('tournaments')
        .update({ status: 'live' })
        .eq('type', 'free')
        .eq('start_time', startStr);
    
    if (error) console.error(error);
    else console.log('✅ Success! Reset complete.');
}

reset();
