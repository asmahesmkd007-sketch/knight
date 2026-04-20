const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://jxzalgpvuamfmoysvkkz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4emFsZ3B2dWFtZm1veXN2a2t6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgzOTY1NCwiZXhwIjoyMDkxNDE1NjU0fQ.SQ1uFQm76DN5B8vC2UhJbcK0DjmWnWbBacf8EkXVXXU'
);

(async () => {
  // Drop old constraint and add new one with locked/playing statuses
  const sql = `
    ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
    ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check 
      CHECK (status IN ('upcoming','full','locked','starting','playing','live','completed','cancelled'));
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.log('RPC not available, constraint may need manual update in Supabase SQL Editor.');
    console.log('Run this SQL:\n' + sql);
  } else {
    console.log('Constraint updated!');
  }
})();
