const fs = require('fs');
const path = './frontend/pages';
const files = fs.readdirSync(path).filter(f => f.endsWith('.html'));

for (let file of files) {
  const fp = path + '/' + file;
  let text = fs.readFileSync(fp, 'utf8');
  
  // 1. Update onclick to go to account.html targeting BOTH settings and empty
  text = text.replace(/onclick="window\.location='\/pages\/(settings|profile)\.html'"/g, 'onclick="window.location=\'/pages/account.html\'"');
  text = text.replace(/<div class="topbar-avatar" id="tb-avatar">/g, '<div class="topbar-avatar" id="tb-avatar" onclick="window.location=\'/pages/account.html\'" style="cursor:pointer">');
  
  // Also any already having onclick for account... make sure cursor is pointer or we just let it be.
  
  // 2. Profile Image Replace Logic
  // Replace the precise string.
  const oldText = `document.getElementById('tb-avatar').textContent = (user.username || 'P').replace('@', '')[0].toUpperCase();`;
  const newAvTpl = `if (user.profile_image) {
  document.getElementById('tb-avatar').innerHTML = \`<img src="\${user.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">\`;
} else {
  document.getElementById('tb-avatar').textContent = (user.username || 'P').replace('@', '')[0].toUpperCase();
}`;
  
  // We only replace it if it's there AND we don't accidentally double-inject it if the file already has the logic
  // WAIT, dashboard has the logic slightly differently for tb-avatar.
  if (text.includes(oldText)) {
     text = text.replace(oldText, newAvTpl);
  }
  
  // For dashboard dash-avatar exclusively!
  if (file === 'dashboard.html') {
    text = text.replace(
      `document.getElementById('dash-avatar').textContent = (user.username || 'P').replace('@', '')[0].toUpperCase();`,
      `if (user.profile_image) {
  document.getElementById('dash-avatar').innerHTML = \`<img src="\${user.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">\`;
} else {
  document.getElementById('dash-avatar').textContent = (user.username || 'P').replace('@', '')[0].toUpperCase();
}`
    );
  }

  // 3. Fix leaderboard magnifying glass
  if (file === 'leaderboard.html') {
    text = text.replace(/.search-bar::before \{ content: '<i class="fa-solid fa-magnifying-glass"><\/i>';/g, '.search-bar::before { content: "";');
    text = text.replace(/<input type="text" class="input" placeholder="Search @username\.\.\." id="lb-search" oninput="searchLeaderboard\(this\.value\)">/g, 
        '<i class="fa-solid fa-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:14px;z-index:1"></i>\n          <input type="text" class="input" placeholder="Search @username..." id="lb-search" oninput="searchLeaderboard(this.value)" style="padding-left:36px;position:relative">');
  }

  fs.writeFileSync(fp, text);
}
console.log('Pages updated');

// Also update sidebar.html
let sb = fs.readFileSync('./frontend/components/sidebar.html', 'utf8');
const avReplace = `
      if (user.profile_image) {
        if (av) av.innerHTML = \`<img src="\${user.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">\`;
      } else {
        if (av) av.textContent = (user.username || 'P').replace('@', '')[0].toUpperCase();
      }
`;
if (sb.includes(`if (av) av.textContent = (user.username || 'P').replace('@', '')[0].toUpperCase();`)) {
   sb = sb.replace(`if (av) av.textContent = (user.username || 'P').replace('@', '')[0].toUpperCase();`, avReplace);
}

// Sidebar click to go to account! User request: "3rd 4th la profile click pana account ku poganum"
sb = sb.replace(/<div class="sidebar-avatar" id="sb-avatar">P<\/div>/g, '<div class="sidebar-avatar" id="sb-avatar" onclick="window.location=\'/pages/account.html\'" style="cursor:pointer">P</div>');

fs.writeFileSync('./frontend/components/sidebar.html', sb);
console.log('Sidebar updated');
