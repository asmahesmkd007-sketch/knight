const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://fbadrybijiwkgdfomjhp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYWRyeWJpaml3a2dkZm9tamhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0NjU1MywiZXhwIjoyMDkyNDIyNTUzfQ.7r89li1qQb02NInaJJdWkEvjH8gGZXHnKnX7ZeRgkXs'
);

async function cleanup() {
    console.log('🧹 Force cleaning 10000 limit Arenas...');
    const { data, error } = await supabase.from('tournaments')
        .delete()
        .eq('type', 'free')
        .eq('max_players', 10000);
    
    if (error) console.error('❌ Error:', error);
    else console.log('✅ Success! Redundant Arenas deleted.');
}

cleanup();
