const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://jxzalgpvuamfmoysvkkz.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4emFsZ3B2dWFtZm1veXN2a2t6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgzOTY1NCwiZXhwIjoyMDkxNDE1NjU0fQ.SQ1uFQm76DN5B8vC2UhJbcK0DjmWnWbBacf8EkXVXXU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  console.log('--- DB Schema Update ---');
  
  // Add round column to matches
  const { error: err1 } = await supabase.rpc('execute_sql', {
    sql: 'ALTER TABLE matches ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1;'
  });
  if (err1) console.log('Error adding round column (ignore if rpc missing):', err1.message);

  // Create leaderboard table
  const { error: err2 } = await supabase.rpc('execute_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS leaderboard (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        rank INTEGER,
        prize NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS lb_tournament_idx ON leaderboard(tournament_id);
    `
  });
  if (err2) console.log('Error creating leaderboard table (ignore if rpc missing):', err2.message);

  console.log('Done.');
}

run();
