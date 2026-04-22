require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const imagePath = 'C:\\Users\\muges\\.gemini\\antigravity\\brain\\24906e12-8d89-4127-90e5-8bef1ff211e9\\modern_chess_tech_1776876798702.png';
const fileName = 'modern_chess_tech.png';

async function upload() {
    const fileBuffer = fs.readFileSync(imagePath);
    await supabase.storage.from('kyc-documents').upload(fileName, fileBuffer, { contentType: 'image/png', upsert: true });
    console.log('Uploaded modern_chess_tech.png');
}
upload();
