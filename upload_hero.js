require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const imagePath = 'C:\\Users\\muges\\.gemini\\antigravity\\brain\\24906e12-8d89-4127-90e5-8bef1ff211e9\\chess_hero_premium_1776876454280.png';
const bucketName = 'kyc-documents';
const fileName = 'chess_hero_premium.png';

async function uploadImage() {
    if (!fs.existsSync(imagePath)) {
        console.error('Local image file not found at:', imagePath);
        return;
    }

    const fileBuffer = fs.readFileSync(imagePath);

    console.log(`Uploading ${fileName} to bucket ${bucketName}...`);
    const { data, error } = await supabase.storage.from(bucketName).upload(fileName, fileBuffer, {
        contentType: 'image/png',
        upsert: true
    });

    if (error) {
        console.error('Upload error:', error.message);
    } else {
        console.log('Upload successful:', data.path);
        const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);
        console.log('Public URL:', publicUrl);
    }
}

uploadImage();
