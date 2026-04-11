const fs = require('fs');
const path = require('path');

const emojiMap = {
  "✏️": '<i class="fa-solid fa-pen"></i>',
  "✏": '<i class="fa-solid fa-pen"></i>',
  "📋": '<i class="fa-solid fa-clipboard"></i>',
  "👤": '<i class="fa-solid fa-user"></i>',
  "🔐": '<i class="fa-solid fa-lock"></i>',
  "🛡️": '<i class="fa-solid fa-shield-halved"></i>',
  "🛡": '<i class="fa-solid fa-shield-halved"></i>',
  "💾": '<i class="fa-solid fa-floppy-disk"></i>',
  "🔒": '<i class="fa-solid fa-lock"></i>',
  "🚪": '<i class="fa-solid fa-door-open"></i>',
  "💪": '<i class="fa-solid fa-dumbbell"></i>',
  "👍": '<i class="fa-solid fa-thumbs-up"></i>',
  "⚠️": '<i class="fa-solid fa-triangle-exclamation"></i>',
  "⚠": '<i class="fa-solid fa-triangle-exclamation"></i>',
  "✓": '<i class="fa-solid fa-check"></i>',
  "✕": '<i class="fa-solid fa-xmark"></i>',
  "✅": '<i class="fa-solid fa-check-circle"></i>',
  "❌": '<i class="fa-solid fa-circle-xmark"></i>',
  "⚡️": '<i class="fa-solid fa-bolt"></i>',
  "⚡": '<i class="fa-solid fa-bolt"></i>',
  "📊": '<i class="fa-solid fa-chart-bar"></i>',
  "👥": '<i class="fa-solid fa-users"></i>',
  "💸": '<i class="fa-solid fa-money-bill-wave"></i>',
  "🏆": '<i class="fa-solid fa-trophy"></i>',
  "♟️": '<i class="fa-solid fa-chess-pawn"></i>',
  "♟": '<i class="fa-solid fa-chess-pawn"></i>',
  "💬": '<i class="fa-solid fa-comment-dots"></i>',
  "➕": '<i class="fa-solid fa-plus"></i>',
  "🟢": '<i class="fa-solid fa-circle" style="color:var(--success);"></i>',
  "⚙️": '<i class="fa-solid fa-gear"></i>',
  "⚙": '<i class="fa-solid fa-gear"></i>',
  "🔍": '<i class="fa-solid fa-magnifying-glass"></i>',
  "🔄": '<i class="fa-solid fa-rotate"></i>',
  "💳": '<i class="fa-solid fa-credit-card"></i>',
  "🥇": '<i class="fa-solid fa-medal" style="color:var(--gold);"></i>',
  "🥈": '<i class="fa-solid fa-medal" style="color:#c0c0c0;"></i>',
  "🥉": '<i class="fa-solid fa-medal" style="color:#cd7f32;"></i>',
  "★": '<i class="fa-solid fa-star"></i>',
  "☆": '<i class="fa-regular fa-star"></i>',
  "🔔": '<i class="fa-solid fa-bell"></i>',
  "💰": '<i class="fa-solid fa-coins"></i>',
  "🪙": '<i class="fa-solid fa-coins"></i>',
  "🎮": '<i class="fa-solid fa-gamepad"></i>',
  "✗": '<i class="fa-solid fa-xmark"></i>',
  "🔴": '<i class="fa-solid fa-circle" style="color:var(--error);"></i>',
  "📬": '<i class="fa-solid fa-envelope-open"></i>',
  "⚔️": '<i class="fa-solid fa-khanda"></i>',
  "⚔": '<i class="fa-solid fa-khanda"></i>',
  "🏳️": '<i class="fa-solid fa-flag"></i>',
  "🏳": '<i class="fa-solid fa-flag"></i>',
  "🤖": '<i class="fa-solid fa-robot"></i>',
  "😞": '<i class="fa-solid fa-face-frown"></i>',
  "🤝": '<i class="fa-solid fa-handshake"></i>',
  "🏁": '<i class="fa-solid fa-flag-checkered"></i>',
  "🎉": '<i class="fa-solid fa-champagne-glasses"></i>',
  "🎲": '<i class="fa-solid fa-dice"></i>',
  "👑": '<i class="fa-solid fa-crown"></i>',
  "♔": '<i class="fa-solid fa-chess-king"></i>',
  "🗄️": '<i class="fa-solid fa-server"></i>',
  "🗄": '<i class="fa-solid fa-server"></i>',
  "🎨": '<i class="fa-solid fa-palette"></i>',
  "🌍": '<i class="fa-solid fa-globe"></i>',
  "👆": '<i class="fa-solid fa-hand-pointer"></i>',
  "🗑️": '<i class="fa-solid fa-trash"></i>',
  "🗑": '<i class="fa-solid fa-trash\"></i>',
  "ℹ": '<i class="fa-solid fa-info-circle"></i>',
  "🔌": '<i class="fa-solid fa-plug"></i>'
};

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) walk(file);
    else if (file.endsWith('.html') || file.endsWith('.js')) { // added .js
      let content = fs.readFileSync(file, 'utf8');
      let modified = false;
      Object.keys(emojiMap).forEach(emj => {
        if (content.includes(emj)) {
          content = content.split(emj).join(emojiMap[emj]);
          modified = true;
          console.log(`Replaced ${emj} in ${file}`);
        }
      });
      if(modified) fs.writeFileSync(file, content, 'utf8');
    }
  });
}

walk('c:/Users/muges/Downloads/phoenix-x-supabase/phoenix-x/frontend/pages');
walk('c:/Users/muges/Downloads/phoenix-x-supabase/phoenix-x/frontend/components');
walk('c:/Users/muges/Downloads/phoenix-x-supabase/phoenix-x/frontend/js');
console.log('Done!');
