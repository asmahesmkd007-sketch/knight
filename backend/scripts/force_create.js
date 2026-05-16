const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://fbadrybijiwkgdfomjhp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYWRyeWJpaml3a2dkZm9tamhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg0NjU1MywiZXhwIjoyMDkyNDIyNTUzfQ.7r89li1qQb02NInaJJdWkEvjH8gGZXHnKnX7ZeRgkXs'
);

async function forceCreate() {
    const categories = [
      { timer: 1, suffix: '1 Min Free TR' },
      { timer: 3, suffix: '3 Min Free TR' },
      { timer: 5, suffix: '5 Min Free TR' },
      { timer: 10, suffix: '10 Min Free TR' }
    ];

    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setMinutes(now.getMinutes() < 30 ? 0 : 30, 0, 0);
    currentStart.setSeconds(0, 0);
    currentStart.setMilliseconds(0);

    const win1 = { start: currentStart, end: new Date(currentStart.getTime() + 30 * 60 * 1000) };
    const win2 = { start: win1.end, end: new Date(win1.end.getTime() + 30 * 60 * 1000) };

    const windows = [
      { ...win1, status: 'live' },
      { ...win2, status: 'upcoming' }
    ];

    for (const cat of categories) {
      for (const win of windows) {
        const { data: existing } = await supabase.from('tournaments')
          .select('id')
          .eq('type', 'free')
          .eq('timer_type', cat.timer)
          .eq('start_time', win.start.toISOString())
          .maybeSingle();

        if (!existing) {
          console.log(`🔨 Creating missing Arena: ${cat.suffix} for ${win.start.toISOString()}`);
          await supabase.from('tournaments').insert({
            name: `Arena - ${cat.suffix}`,
            type: 'free',
            format: 'standard',
            entry_fee: 0,
            timer_type: cat.timer,
            max_players: 500,
            current_players: 0,
            status: win.status,
            start_time: win.start.toISOString(),
            end_time: win.end.toISOString()
          });
        } else {
            console.log(`✅ Already exists: ${cat.suffix} for ${win.start.toISOString()}`);
        }
      }
    }
}

forceCreate();
