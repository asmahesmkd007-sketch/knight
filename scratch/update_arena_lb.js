
const fs = require('fs');
const path = 'frontend/pages/tournament-live.html';
let c = fs.readFileSync(path, 'utf8');

const oldStr = "else if (i === 2) { statusText = '3rd WINNER 🥉'; statusColor = '#cd7f32'; }";
const newStr = `else if (i === 2) { statusText = '3rd WINNER 🥉'; statusColor = '#cd7f32'; }
            else if (i === 3 && tournamentConfig.timer_type === 3) { statusText = '4th WINNER 🎖️'; statusColor = '#5bc0eb'; }
            else if (i === 4 && tournamentConfig.timer_type === 3) { statusText = '5th WINNER 🎗️'; statusColor = '#9b59b6'; }
            else if (i === 5 && tournamentConfig.timer_type === 3) { statusText = '6th WINNER 💠'; statusColor = '#3498db'; }`;

if (c.includes(oldStr)) {
    c = c.replace(oldStr, newStr);
    fs.writeFileSync(path, c);
    console.log('✅ Leaderboard labels updated successfully!');
} else {
    console.error('❌ Could not find the target string for replacement.');
}
