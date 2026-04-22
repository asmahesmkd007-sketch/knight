require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const users = [];
for (let i = 2; i <= 32; i++) {
    users.push({
        username: `@test${i}`,
        full_name: `test${i}`,
        email: `test${i}@gamil.com`,
        password: `1234567890`
    });
}

async function addUsers() {
    console.log(`Starting to add ${users.length} users...`);
    
    for (const user of users) {
        try {
            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true
            });

            if (authError) {
                console.error(`Error creating auth user ${user.email}:`, authError.message);
                continue;
            }

            const userId = authData.user.id;

            // 2. Create Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    username: user.username,
                    full_name: user.full_name
                });

            if (profileError) {
                console.error(`Error creating profile for ${user.username}:`, profileError.message);
                // Try to cleanup auth user
                await supabase.auth.admin.deleteUser(userId);
                continue;
            }

            // Wallet and welcome notification are handled by triggers in the DB (on_profile_created)
            // Wait, let's verify if the notification is a trigger.
            // In auth.controller.js it was manual. In the schema I only saw wallet trigger.
            
            // Manual Welcome Notification (matching auth.controller.js)
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'welcome',
                title: 'Welcome to PHOENIX X! ♔',
                message: 'Your account is ready. Complete KYC to unlock wallet & paid tournaments.'
            });

            console.log(`Successfully added ${user.username} (${user.email})`);
        } catch (err) {
            console.error(`Unexpected error for ${user.email}:`, err.message);
        }
    }
    console.log('Finished processing users.');
}

addUsers();
