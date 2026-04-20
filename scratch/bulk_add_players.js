const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://jxzalgpvuamfmoysvkkz.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4emFsZ3B2dWFtZm1veXN2a2t6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgzOTY1NCwiZXhwIjoyMDkxNDE1NjU0fQ.SQ1uFQm76DN5B8vC2UhJbcK0DjmWnWbBacf8EkXVXXU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const userIds = [
  "b1367e61-f5e9-4105-ba25-9cf8d76376a1", // @santha_arun
  "90f3d283-19ce-4b99-b565-00c62b6c1459", // @new_new
  "8298258d-9635-4d14-8b5c-30ccc41d52a3", // @new_nrw
  "4c13a26f-4a28-42cf-ac95-5e886415eeea", // @m_radha
  "f2c0e60e-b6fe-4c14-a44b-4e29e0ff3d2e", // @new_mew
  "fb40bb77-2d48-4a5d-ba94-e4af3b8025bb", // @phoenix_tamilyt
  "64bc8c43-f99f-450b-ba5a-aaa3a557f4f3", // @phoenix_brothers
  "186016ec-93e4-4165-854d-ab92bb10055c", // @testing
  "29b29dc7-6549-4e02-a5d2-2ff418f1806c", // @player6540
  "280a76f6-941e-4c3c-be17-408231986ce9", // @nnan_nana
  "010701a1-19f6-40d6-911b-c7327160bedb", // @mage
  "e38d271b-5f63-431e-a0e4-4f5d5cf123f7", // @phoenix_tamil
  "a4506ade-9e36-45f9-832b-a03b5d22e914", // @mana_ansn
  "4cac6773-4656-47ed-9ea3-47d5fc9a128c", // @phoenix
  "3fc049da-d6bf-415a-b2e0-b5bd3f79180e"  // @ma_hes
];

async function bulkAdd() {
  console.log("Fetching all upcoming 1-min tournaments...");
  const { data: tourneys } = await supabase.from('tournaments')
    .select('id, name, current_players')
    .eq('status', 'upcoming')
    .eq('timer_type', 1);

  if (!tourneys || tourneys.length === 0) return console.log("No upcoming 1-min tournaments found.");

  for (const t of tourneys) {
    console.log(`Processing ${t.name} (${t.id})...`);

    // Clear existing players to ensure exactly these 15 are in
    await supabase.from('tournament_players').delete().eq('tournament_id', t.id);

    // Add these 15
    const rows = userIds.map(uid => ({
      tournament_id: t.id,
      user_id: uid
    }));

    const { error: insertError } = await supabase.from('tournament_players').insert(rows);
    if (insertError) {
      console.error(`Error inserting into ${t.id}:`, insertError);
    } else {
      // Update count
      await supabase.from('tournaments').update({ current_players: 15 }).eq('id', t.id);
      console.log(`Successfully added 15 players to ${t.name}`);
    }
  }
  console.log("Bulk process complete.");
}

bulkAdd();
