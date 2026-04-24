const fs = require('fs');
const path = 'c:\\Users\\muges\\Downloads\\phoenix-x\\frontend\\pages\\admin.html';
let content = fs.readFileSync(path, 'utf8');

// Match the problematic block regardless of newlines/spaces
const pattern = /\$\{t\.status === 'upcoming' \|\| t\.status === 'locked' \? `<button\s+class="btn-reject"/g;
const replacement = "${t.status !== 'completed' && t.status !== 'cancelled' ? `<button class=\"btn-reject\"";

if (content.match(pattern)) {
    content = content.replace(pattern, replacement);
    fs.writeFileSync(path, content);
    console.log('✅ Successfully patched admin.html');
} else {
    console.log('❌ Pattern not found');
    // Log a snippet for debugging
    const idx = content.indexOf('cancelTournamentAdmin');
    console.log('Snippet:', content.substring(idx - 100, idx + 100));
}
