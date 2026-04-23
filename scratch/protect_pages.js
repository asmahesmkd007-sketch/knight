const fs = require('fs');
const path = require('path');

const pagesDir = 'c:\\Users\\muges\\Downloads\\phoenix-x\\frontend\\pages';
const files = fs.readdirSync(pagesDir);

files.forEach(file => {
    if (file === 'login.html') return;
    if (!file.endsWith('.html')) return;

    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Skip if already has requireAuth
    if (content.includes('requireAuth()')) {
        console.log(`Skipping ${file} - already protected.`);
        return;
    }

    // Pattern 1: DOMContentLoaded
    const domLoadPattern = /(window|document)\.addEventListener\('DOMContentLoaded',\s*async\s*\(\)\s*=>\s*\{/g;
    if (domLoadPattern.test(content)) {
        content = content.replace(domLoadPattern, (match) => match + "\n      if (!requireAuth()) return;");
        console.log(`Protected ${file} (DOMContentLoaded)`);
    } else if (content.includes("<script>")) {
        // Pattern 2: Simple <script>
        content = content.replace("<script>", "<script>\n        if (!requireAuth()) return;");
        console.log(`Protected ${file} (Simple Script)`);
    } else {
        console.log(`Could not find hook for ${file}`);
    }

    fs.writeFileSync(filePath, content);
});
