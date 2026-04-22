require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fixBucket() {
    console.log('Checking kyc-documents bucket...');
    const { data, error } = await supabase.storage.getBucket('kyc-documents');
    
    if (error) {
        if (error.message === 'Bucket not found') {
            console.log('Bucket not found. Creating kyc-documents (public)...');
            const { error: createError } = await supabase.storage.createBucket('kyc-documents', { public: true });
            if (createError) console.error('Create error:', createError);
            else console.log('Bucket created successfully.');
        } else {
            console.error('Error getting bucket:', error);
        }
        return;
    }

    if (!data.public) {
        console.log('Bucket is private. Updating to public...');
        const { error: updateError } = await supabase.storage.updateBucket('kyc-documents', { public: true });
        if (updateError) console.error('Update error:', updateError);
        else console.log('Bucket updated to public successfully.');
    } else {
        console.log('Bucket is already public.');
    }
}

fixBucket();
