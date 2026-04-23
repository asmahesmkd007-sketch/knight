require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function addUsers() {
    console.log(`Starting to add users from test33 to test100...`);
    
    for (let i = 33; i <= 100; i++) {
        const username = `@test${i}`;
        const email = `test${i}@gamil.com`;
        const password = `1234567890`;

        try {
            // Check if exists
            const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).single();
            if (existing) {
                console.log(`User ${username} already exists.`);
                continue;
            }

            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true
            });

            if (authError) {
                console.error(`Error creating auth user ${email}:`, authError.message);
                continue;
            }

            const userId = authData.user.id;

            // 2. Create Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    username: username,
                    full_name: `test${i}`
                });

            if (profileError) {
                console.error(`Error creating profile for ${username}:`, profileError.message);
                await supabase.auth.admin.deleteUser(userId);
                continue;
            }

            // Welcome Notification
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'welcome',
                title: 'Welcome to PHOENIX X! ♔',
                message: 'Your account is ready.'
            });

            console.log(`Successfully added ${username}`);
        } catch (err) {
            console.error(`Unexpected error for ${username}:`, err.message);
        }
    }
    console.log('Finished processing users.');
}

addUsers();
