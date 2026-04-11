const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if (file === 'node_modules' || file === '.git' || file === '.next') return;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(fullPath));
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walkDir(path.join(__dirname, 'frontend'));
const backendFiles = walkDir(path.join(__dirname, 'backend'));
const allFiles = [...files, ...backendFiles];

const issues = [];

allFiles.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    
    // Check 1: HTML attributes containing '<' or '>' incorrectly like placeholders
    if (f.endsWith('.html')) {
        const placeholderMatch = content.match(/placeholder\=\"[^\"]*\<[^\"]*\"/g);
        if (placeholderMatch) issues.push('HTML Attribute Error in ' + f + ': ' + placeholderMatch[0]);
    }

    // Check 2: Unclosed generic HTML tags (heuristic)
    if (f.endsWith('.html')) {
        const divsOpen = (content.match(/<div(\s|>)/g) || []).length;
        const divsClose = (content.match(/<\/div>/g) || []).length;
        if (divsOpen !== divsClose) {
            issues.push(`Div mismatch in ${f}: Open: ${divsOpen}, Close: ${divsClose}`);
        }
    }

    // Check 3: Check for inline regex that historically cause IDE errors
    if (f.endsWith('.html')) {
        // Find /something/ followed by [ or . inside a string but not inside 
        const regexSyntax = content.match(/\/[^\n\r\/]+\/[\w]*\[/g);
        if (regexSyntax) {
           issues.push(`Potential IDE regex parsing warning in ${f}: ${regexSyntax[0]}`);
        }
    }

    // Check 4: For backend, check JS compilation/syntax
    if (f.endsWith('.js')) {
        try {
            // simple parse using Function constructor
            new Function(content);
        } catch (e) {
            // For backend JS, Function constructor evaluates globally, 
            // `module.exports` might fail inside `new Function`, but SyntaxErrors will throw.
            if (e instanceof SyntaxError) {
                issues.push(`SyntaxError in ${f}: ${e.message}`);
            }
        }
    }
});

console.log(issues.length ? issues.join('\n') : 'No significant syntax errors found during static scan.');
