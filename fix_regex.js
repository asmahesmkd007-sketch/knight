const fs = require('fs');
const path = require('path');

function fixFiles(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file === 'node_modules') return;
            fixFiles(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            // Replace inline regex replace(/^@/, '') which breaks VSCode lexer
            const genericRegex = /replace\(\/\^@\/,\s*['"]['"]\)/g;
            if (genericRegex.test(content)) {
                content = content.replace(genericRegex, "replace('@', '')");
                modified = true;
            }

            // Replace new RegExp('^@') because we made that up but it's clumsier than replace('@', '')
            if (content.includes("replace(new RegExp('^@'),'')")) {
                content = content.replace(/replace\(new RegExp\('\^@'\),''\)/g, "replace('@', '')");
                modified = true;
            }

            // In template strings, replace </div> with <\/div> to prevent HTML parser breaking out of script tag
            // We only do this if it's inside a script tag. An easy heuristic is checking for `.innerHTML = `
            if (content.includes('.innerHTML = `') || content.includes('return `')) {
                // Actually, just find the exact block in tournamentlive and admin
                if (file === 'tournament-live.html' || file === 'admin.html') {
                    content = content.replace(/(return \`[\s\S]*?)<\/div>/g, "$1<\\/div>");
                    modified = true;
                }
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed:', fullPath);
            }
        }
    });
}
fixFiles(path.join(__dirname, 'frontend'));
console.log('Done fixing HTML JS strings.');
