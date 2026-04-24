const fs = require('fs');
const path = 'c:\\Users\\muges\\Downloads\\phoenix-x\\frontend\\pages\\admin.html';
let content = fs.readFileSync(path, 'utf8');

// The goal is to ensure the Timer Type select exists and does NOT have the 5 minute option.
// And to fix any broken grid-2 structure.

const timerGroupRegex = /<div class="input-group">\s*<label class="input-label">Timer Type<\/label>[\s\S]*?<\/select>\s*<\/div>/g;
const timerGroupReplacement = `
            <div class="input-group">
              <label class="input-label">Timer Type</label>
              <select id="ct-timer" class="input">
                <option value="1">1 minute</option>
                <option value="3">3 minutes</option>
                <option value="10">10 minutes</option>
              </select>
            </div>`;

if (content.match(timerGroupRegex)) {
    content = content.replace(timerGroupRegex, timerGroupReplacement);
    console.log('✅ Updated Timer Type select.');
} else {
    console.log('❌ Timer Type group not found. Attempting to restore structure...');
    // If I deleted too much, let's restore the whole block from Format to Duration
    const formatStart = content.indexOf('<select id="ct-format"');
    const durationEnd = content.indexOf('id="ct-duration"');
    
    if (formatStart !== -1 && durationEnd !== -1) {
        // This is a bit risky but let's try to find the container
        const start = content.lastIndexOf('<div class="grid-2"', formatStart);
        const end = content.indexOf('</div>', content.indexOf('</div>', durationEnd) + 1); // Get outer div
        
        const restoredBlock = `
          <div class="grid-2" style="gap: 16px">
            <div class="input-group">
              <label class="input-label">Format</label>
              <select id="ct-format" class="input">
                <option value="standard">Standard</option>
                <option value="quick">Quick (20min)</option>
                <option value="battle">Battle (30min)</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Timer Type</label>
              <select id="ct-timer" class="input">
                <option value="1">1 minute</option>
                <option value="3">3 minutes</option>
                <option value="10">10 minutes</option>
              </select>
            </div>
          </div>
          <div class="grid-2" style="gap: 16px">
            <div class="input-group">
              <label class="input-label">Max Players</label>
              <input type="number" id="ct-maxplayers" class="input" value="500" min="2" max="1000" />
            </div>
            <div class="input-group">
              <label class="input-label">Start Time</label>
              <input type="datetime-local" id="ct-start" class="input" />
            </div>
          </div>`;
          
          // Since I don't know exactly what I deleted, I'll use a safer approach:
          // Match the area between ct-type and ct-duration
    }
}

// SIMPLER APPROACH: Replace the whole "Create Tournament" section
const createSectionRegex = /<!-- CREATE TOURNAMENT PAGE -->[\s\S]*?<!-- TOURNAMENT DETAIL MODAL -->/;
const newCreateSection = `<!-- CREATE TOURNAMENT PAGE -->
      <div class="admin-page" id="page-create-tournament">
        <div class="card" style="max-width: 600px">
          <div class="card-title">Create New Tournament</div>
          <div class="input-group">
            <label class="input-label">Tournament Name</label>
            <input type="text" id="ct-name" class="input" placeholder="PHOENIX Battle #1" />
          </div>
          <div class="grid-2" style="gap: 16px">
            <div class="input-group">
              <label class="input-label">Type</label>
              <select id="ct-type" class="input" onchange="toggleEntryFee()">
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Format</label>
              <select id="ct-format" class="input">
                <option value="standard">Standard</option>
                <option value="quick">Quick (20min)</option>
                <option value="battle">Battle (30min)</option>
              </select>
            </div>
          </div>
          <div class="grid-2" style="gap: 16px">
            <div class="input-group">
              <label class="input-label">Timer Type</label>
              <select id="ct-timer" class="input">
                <option value="1">1 minute</option>
                <option value="3">3 minutes</option>
                <option value="10">10 minutes</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Max Players</label>
              <input type="number" id="ct-maxplayers" class="input" value="500" min="2" max="1000" />
            </div>
          </div>
          <div class="grid-2" style="gap: 16px">
            <div class="input-group">
              <label class="input-label">Start Time</label>
              <input type="datetime-local" id="ct-start" class="input" />
            </div>
            <div class="input-group">
              <label class="input-label">Duration (minutes)</label>
              <input type="number" id="ct-duration" class="input" value="30" min="10" />
            </div>
          </div>
          <div id="entry-fee-section">
            <div class="card-title" style="margin-top: 8px">
              Entry Fee & Prizes
            </div>
            <div class="grid-2" style="gap: 12px">
              <div class="input-group">
                <label class="input-label">Entry Fee (coins)</label><input type="number" id="ct-fee" class="input"
                  value="0" min="0" oninput="calcPrizePool()" />
              </div>
              <div class="input-group">
                <label class="input-label">Prize Pool (auto)</label><input type="number" id="ct-pool" class="input"
                  readonly style="opacity: 0.7" />
              </div>
            </div>
            <div class="grid-3" style="gap: 12px">
              <div class="input-group">
                <label class="input-label">1st Prize</label><input type="number" id="ct-p1" class="input" value="0" />
              </div>
              <div class="input-group">
                <label class="input-label">2nd Prize</label><input type="number" id="ct-p2" class="input" value="0" />
              </div>
              <div class="input-group">
                <label class="input-label">3rd Prize</label><input type="number" id="ct-p3" class="input" value="0" />
              </div>
            </div>
          </div>
          <div id="ct-error" class="error-msg" style="margin-bottom: 12px"></div>
          <button class="btn btn-primary btn-lg" onclick="createTournament()">
            <i class="fa-solid fa-plus"></i> Create Tournament
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- TOURNAMENT DETAIL MODAL -->`;

if (content.match(createSectionRegex)) {
    content = content.replace(createSectionRegex, newCreateSection);
    fs.writeFileSync(path, content);
    console.log('✅ Successfully restored and updated Create Tournament section.');
} else {
    console.log('❌ Create Tournament section not found.');
}
