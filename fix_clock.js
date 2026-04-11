const fs = require('fs');
const path = require('path');

function replaceEmoji(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceEmoji(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            // Wait, we can just replace '⏰' or '⏰ '
            // Use regex to catch either
            if (content.includes('⏰')) {
                // If it is followed by a space, we can just replace the emoji itself so the space remains
                content = content.replace(/⏰/g, '<i class="fa-solid fa-clock"></i>');
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed', fullPath);
            }
        }
    });
}
replaceEmoji(path.join(__dirname, 'frontend'));
console.log('Emoji replacement complete');
