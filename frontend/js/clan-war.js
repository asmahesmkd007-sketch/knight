/* ============================================================
   CLAN WAR — Frontend Logic  (clan-war.js)
   Uses: api.js (ClanAPI, Toast, fmt, getUser, requireAuth)
   ============================================================ */

'use strict';

// ─── STATE ───────────────────────────────────────────────────
let currentUser = null;
let myClan      = null;
let myWar       = null;
let activeTab   = 'war';
let selectedLineup = new Set();

// ─── INIT ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  // Sidebar
  const sc = document.getElementById('sidebar-container');
  if (sc) {
    const resp = await fetch('/components/sidebar.html');
    sc.innerHTML = await resp.text();
    const scripts = sc.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const s = document.createElement('script');
      s.text = scripts[i].text;
      document.body.appendChild(s);
    }
  }

  currentUser = getUser();
  if (currentUser) {
    document.getElementById('tb-player-id').textContent = currentUser.player_id || 'PX-SYNCING...';
    const av = document.getElementById('tb-avatar');
    av.innerHTML = currentUser.profile_image
      ? `<img src="${currentUser.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : (currentUser.username || 'P').replace('@','')[0].toUpperCase();
    if (typeof updateSidebarUI === 'function') updateSidebarUI(currentUser);
  }

  await loadPage();
});

// ─── LOAD PAGE ───────────────────────────────────────────────
async function loadPage() {
  showLoading();
  try {
    const res = await ClanAPI.getMyClan();
    if (res.success && res.clan) {
      myClan = res.clan;
      await loadWarData();
      renderClanDashboard();
    } else {
      renderNoClan();
    }
  } catch (e) {
    console.error(e);
    renderNoClan();
  }
}

async function loadWarData() {
  try {
    const res = await ClanAPI.getMyWar();
    myWar = (res.success && res.war) ? res.war : null;
  } catch { myWar = null; }
}

function showLoading() {
  document.getElementById('page-content').innerHTML =
    '<div class="cw-loading"><div class="spinner"></div><p>Loading Clan War...</p></div>';
}

// ─── NO CLAN VIEW ─────────────────────────────────────────────
function renderNoClan() {
  document.getElementById('page-content').innerHTML = `
    <div class="cw-no-clan">
      <div class="cw-no-clan-icon"><i class="fa-solid fa-khanda"></i></div>
      <h2>No Clan Yet</h2>
      <p>Create your own clan or join an existing one to participate in epic Clan Wars.</p>
      <div class="cw-no-clan-actions">
        <button class="btn btn-primary" onclick="openCreateClanModal()">
          <i class="fa-solid fa-plus"></i> Create Clan
        </button>
        <button class="btn btn-secondary" onclick="openSearchClanModal()">
          <i class="fa-solid fa-magnifying-glass"></i> Find a Clan
        </button>
        <button class="btn btn-ghost" onclick="renderLeaderboardView()">
          <i class="fa-solid fa-trophy"></i> Leaderboard
        </button>
      </div>
    </div>
    ${createClanModal()}
    ${searchClanModal()}
  `;
}

// ─── CLAN DASHBOARD ───────────────────────────────────────────
function renderClanDashboard() {
  const isLeader = ['leader','co_leader'].includes(myClan.my_role);
  const winRate  = myClan.total_wars > 0 ? Math.round((myClan.war_wins / myClan.total_wars) * 100) : 0;

  document.getElementById('page-content').innerHTML = `
    <!-- Pending war alerts -->
    <div id="pending-wars-container"></div>

    <!-- Clan Hero -->
    <div class="clan-hero">
      <div class="clan-hero-top">
        <div class="clan-tag-badge">${esc(myClan.tag)}</div>
        <div class="clan-hero-info">
          <div class="clan-hero-name">${esc(myClan.name)}</div>
          <div class="clan-hero-desc">${esc(myClan.description || 'No description set.')}</div>
          <div class="clan-hero-meta">
            <span class="clan-meta-pill"><i class="fa-solid fa-users"></i> ${myClan.total_members}/20 Members</span>
            <span class="clan-meta-pill"><i class="fa-solid fa-crown"></i> ${getRoleLabel(myClan.my_role)}</span>
            <span class="clan-meta-pill"><i class="fa-solid fa-shield-halved"></i> ${myClan.total_wars || 0} Wars</span>
          </div>
        </div>
      </div>
      <div class="clan-hero-actions">
        ${isLeader ? `<button class="btn btn-primary btn-sm" onclick="openDeclareWarModal()"><i class="fa-solid fa-khanda"></i> Declare War</button>` : ''}
        ${isLeader ? `<button class="btn btn-secondary btn-sm" onclick="openLineupModal()"><i class="fa-solid fa-list-check"></i> Set Lineup</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="renderLeaderboardView()"><i class="fa-solid fa-trophy"></i> Leaderboard</button>
        <button class="btn btn-ghost btn-sm" onclick="openWarHistoryModal()"><i class="fa-solid fa-clock-rotate-left"></i> History</button>
        ${myClan.my_role !== 'leader' ? `<button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="confirmLeaveClan()"><i class="fa-solid fa-right-from-bracket"></i> Leave</button>` : ''}
        ${myClan.my_role === 'leader' ? `<button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="confirmDeleteClan()"><i class="fa-solid fa-trash-can"></i> Delete Clan</button>` : ''}
      </div>
    </div>

    <!-- Stats Row -->
    <div class="clan-stats-row">
      <div class="clan-stat-tile">
        <div class="clan-stat-val">${myClan.war_wins || 0}</div>
        <div class="clan-stat-label">War Wins</div>
      </div>
      <div class="clan-stat-tile">
        <div class="clan-stat-val">${myClan.total_wars || 0}</div>
        <div class="clan-stat-label">Total Wars</div>
      </div>
      <div class="clan-stat-tile">
        <div class="clan-stat-val">${winRate}%</div>
        <div class="clan-stat-label">Win Rate</div>
      </div>
      <div class="clan-stat-tile">
        <div class="clan-stat-val">${myClan.war_points || 0}</div>
        <div class="clan-stat-label">War Points</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="cw-tabs">
      <button class="cw-tab ${activeTab==='war'?'active':''}" data-tab="war" onclick="switchTab('war')"><i class="fa-solid fa-khanda"></i> Active War</button>
      <button class="cw-tab ${activeTab==='members'?'active':''}" data-tab="members" onclick="switchTab('members')"><i class="fa-solid fa-users"></i> Members</button>
      ${isLeader ? `<button class="cw-tab ${activeTab==='requests'?'active':''}" data-tab="requests" onclick="switchTab('requests')"><i class="fa-solid fa-envelope-open-text"></i> Requests <span id="req-count-badge" class="badge badge-error" style="display:none;font-size:9px;padding:1px 4px;margin-left:4px"></span></button>` : ''}
      <button class="cw-tab ${activeTab==='rules'?'active':''}" data-tab="rules" onclick="switchTab('rules')"><i class="fa-solid fa-book"></i> Rules</button>
    </div>

    <!-- Tab Content -->
    <div id="tab-content"></div>

    <!-- Modals -->
    ${createClanModal()}
    ${declareWarModal()}
    ${lineupModal()}
    ${warHistoryModal()}
    ${searchClanModal()}
  `;

  loadPendingWars();
  if (isLeader) loadJoinRequests();
  renderTab(activeTab);
}

let pendingRequests = [];
async function loadJoinRequests() {
  try {
    const res = await ClanAPI.getJoinRequests();
    if (res.success) {
      pendingRequests = res.requests || [];
      const badge = document.getElementById('req-count-badge');
      if (badge) {
        if (pendingRequests.length > 0) {
          badge.textContent = pendingRequests.length;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch {}
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.cw-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderTab(tab);
}

function renderTab(tab) {
  const el = document.getElementById('tab-content');
  if (!el) return;
  if (tab === 'war')      renderWarTab(el);
  if (tab === 'members')  renderMembersTab(el);
  if (tab === 'requests') renderRequestsTab(el);
  if (tab === 'rules')    renderRulesTab(el);
}

// ─── WAR TAB ──────────────────────────────────────────────────
function renderWarTab(el) {
  if (!myWar) {
    el.innerHTML = `
      <div class="cw-empty">
        <i class="fa-solid fa-khanda"></i>
        <p>No active war. ${['leader','co_leader'].includes(myClan?.my_role) ? 'Declare war on another clan to begin!' : 'Ask your leader to declare a war.'}</p>
      </div>`;
    return;
  }

  const isA = myWar.clan_a?.id === myClan.id;
  const myClanData  = isA ? myWar.clan_a : myWar.clan_b;
  const oppClanData = isA ? myWar.clan_b : myWar.clan_a;
  const myScore     = isA ? myWar.score_a : myWar.score_b;
  const oppScore    = isA ? myWar.score_b : myWar.score_a;
  const totalMatches = (myWar.matches || []).length;
  const doneMatches  = (myWar.matches || []).filter(m => m.status === 'finished').length;
  const progress     = totalMatches > 0 ? Math.round((doneMatches / totalMatches) * 100) : 0;
  const timeLeft     = getTimeLeft(myWar.end_time);
  const statusClass  = myWar.status === 'active' ? 'war-active' : 'war-pending';

  el.innerHTML = `
    <div class="war-status-card ${statusClass}">
      <div class="cw-section-header">
        <div class="cw-section-title"><i class="fa-solid fa-khanda"></i> War Status</div>
        <span class="badge ${myWar.status === 'active' ? 'badge-success' : 'badge-warning'}">${myWar.status.toUpperCase()}</span>
      </div>
      <div class="war-vs-row">
        <div class="war-clan-side">
          <div class="war-clan-tag">[${esc(myClanData?.tag||'?')}]</div>
          <div class="war-clan-name">${esc(myClanData?.name||'Your Clan')}</div>
          <div class="war-score">${myScore}</div>
        </div>
        <div class="war-vs-divider">
          <div class="war-vs-text">VS</div>
          <div class="war-timer"><i class="fa-regular fa-clock"></i> ${timeLeft}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${doneMatches}/${totalMatches} matches done</div>
        </div>
        <div class="war-clan-side">
          <div class="war-clan-tag">[${esc(oppClanData?.tag||'?')}]</div>
          <div class="war-clan-name">${esc(oppClanData?.name||'Opponent')}</div>
          <div class="war-score">${oppScore}</div>
        </div>
      </div>
      <div class="war-progress-bar"><div class="war-progress-fill" style="width:${progress}%"></div></div>
    </div>

    <div class="cw-section-header" style="margin-top:24px">
      <div class="cw-section-title"><i class="fa-solid fa-chess-board"></i> Match Results</div>
      ${['leader','co_leader'].includes(myClan?.my_role) && myWar.status === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="openLineupModal()"><i class="fa-solid fa-list-check"></i> Edit Lineup</button>` : ''}
    </div>
    <div class="war-matches-grid">
      ${(myWar.matches||[]).length === 0
        ? `<div class="cw-empty" style="grid-column:1/-1"><i class="fa-solid fa-chess-board"></i><p>No matches yet. War lineup must be set first.</p></div>`
        : (myWar.matches||[]).map(m => renderWarMatchCard(m, isA)).join('')
      }
    </div>
  `;
}

function renderWarMatchCard(m, isA) {
  const p1 = m.p1 || {};
  const p2 = m.p2 || {};
  const p1Name = p1.username || 'Player 1';
  const p2Name = p2.username || 'Player 2';
  const p1Av = p1.profile_image ? `<img src="${p1.profile_image}">` : p1Name[0]?.toUpperCase();
  const p2Av = p2.profile_image ? `<img src="${p2.profile_image}">` : p2Name[0]?.toUpperCase();

  let resultHtml = '';
  let statusClass = 'status-' + m.status;
  if (m.status === 'finished') {
    const r = m.result || '';
    if (r === 'player1_win') resultHtml = `<div class="wmc-result win"><i class="fa-solid fa-crown"></i> P1 Wins</div>`;
    else if (r === 'player2_win') resultHtml = `<div class="wmc-result win"><i class="fa-solid fa-crown"></i> P2 Wins</div>`;
    else if (r === 'draw') resultHtml = `<div class="wmc-result draw">Draw${m.move_count < 12 ? ' (Invalid)' : ''}</div>`;
    else if (r.includes('forfeit')) resultHtml = `<div class="wmc-result loss">Forfeit</div>`;
    else if (r.includes('no_show')) resultHtml = `<div class="wmc-result loss">No-Show</div>`;
  } else if (m.status === 'active') {
    resultHtml = `<div class="wmc-result active"><i class="fa-solid fa-circle-dot"></i> Live</div>`;
  } else {
    resultHtml = `<div class="wmc-result pending">Pending</div>`;
  }

  const p1pts = m.p1_points || 0;
  const p2pts = m.p2_points || 0;
  const ptsClass = (n) => n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero';

  return `
    <div class="war-match-card ${statusClass}">
      <div class="wmc-players">
        <div class="wmc-player">
          <div class="wmc-avatar">${p1Av}</div>
          <div class="wmc-name">${esc(p1Name)}</div>
        </div>
        <div class="wmc-vs">VS</div>
        <div class="wmc-player">
          <div class="wmc-avatar">${p2Av}</div>
          <div class="wmc-name">${esc(p2Name)}</div>
        </div>
      </div>
      ${resultHtml}
      ${m.status === 'finished' ? `
        <div class="wmc-points">
          <span class="wmc-pts-val ${ptsClass(p1pts)}">${p1pts > 0 ? '+' : ''}${p1pts} pts</span>
          <span class="wmc-pts-val ${ptsClass(p2pts)}">${p2pts > 0 ? '+' : ''}${p2pts} pts</span>
        </div>` : ''}
    </div>`;
}

// ─── MEMBERS TAB ──────────────────────────────────────────────
function renderMembersTab(el) {
  const members = myClan.members || [];
  const isLeader = myClan.my_role === 'leader';
  const isCoLeader = myClan.my_role === 'co_leader';
  const canManage = isLeader || isCoLeader;

  el.innerHTML = `
    <div class="cw-section-header">
      <div class="cw-section-title"><i class="fa-solid fa-users"></i> Members (${members.length}/20)</div>
      ${canManage ? `<button class="btn btn-secondary btn-sm" onclick="openInviteMemberPrompt()"><i class="fa-solid fa-user-plus"></i> Invite</button>` : ''}
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="members-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Role</th>
            <th>Status</th>
            <th>IQ</th>
            ${canManage ? '<th>Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${members.map(m => {
            const p = m.profiles || {};
            const name = p.username || 'Unknown';
            const av = p.profile_image ? `<img src="${p.profile_image}">` : name[0]?.toUpperCase();
            const isMe = p.id === currentUser?.id;
            return `
              <tr>
                <td>
                  <div class="member-avatar-sm">${av}</div>
                  ${esc(name)}${isMe ? ' <span style="color:var(--gold);font-size:10px">(you)</span>' : ''}
                </td>
                <td><span class="role-badge ${m.role}">${getRoleLabel(m.role)}</span></td>
                <td><span class="online-dot ${p.is_online?'online':''}"></span>${p.is_online?'Online':'Offline'}</td>
                <td>${p.iq_level || 100}</td>
                ${canManage && !isMe && m.role !== 'leader' ? `
                  <td>
                    ${isLeader && m.role === 'member' ? `<button class="btn btn-ghost btn-xs" onclick="promoteToCoLeader('${p.id}','${esc(name)}')">Promote</button>` : ''}
                    ${isLeader && m.role === 'co_leader' ? `<button class="btn btn-ghost btn-xs" onclick="demoteToMember('${p.id}','${esc(name)}')">Demote</button>` : ''}
                    ${isLeader ? `<button class="btn btn-ghost btn-xs" style="color:var(--gold)" onclick="confirmTransferLeadership('${p.id}','${esc(name)}')">Transfer</button>` : ''}
                    <button class="btn btn-ghost btn-xs" style="color:var(--error)" onclick="kickMember('${p.id}','${esc(name)}')">Kick</button>
                  </td>` : (canManage ? '<td>—</td>' : '')}
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── REQUESTS TAB ─────────────────────────────────────────────
function renderRequestsTab(el) {
  if (pendingRequests.length === 0) {
    el.innerHTML = `
      <div class="cw-empty">
        <i class="fa-solid fa-envelope-open-text"></i>
        <p>No pending join requests.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="cw-section-header">
      <div class="cw-section-title"><i class="fa-solid fa-envelope-open-text"></i> Join Requests (${pendingRequests.length})</div>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="members-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>IQ / Rank</th>
            <th>Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pendingRequests.map(r => {
            const p = r.profiles || {};
            const name = p.username || 'Unknown';
            return `
              <tr>
                <td>
                  <div class="member-avatar-sm">${name[0]?.toUpperCase()}</div>
                  ${esc(name)}
                </td>
                <td>${p.iq_level || 100} / ${esc(p.rank || 'Bronze')}</td>
                <td>${fmt.relTime(r.created_at)}</td>
                <td>
                  <button class="btn btn-primary btn-xs" onclick="respondJoinRequest('${r.id}','accept')">Accept</button>
                  <button class="btn btn-ghost btn-xs" style="color:var(--error)" onclick="respondJoinRequest('${r.id}','reject')">Reject</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

async function respondJoinRequest(requestId, action) {
  const btn = event?.target;
  if (btn) btn.disabled = true;

  try {
    const res = await ClanAPI.respondJoinRequest({ requestId, action });
    if (res.success) {
      Toast.success(res.message);
      await loadJoinRequests();
      if (activeTab === 'requests') renderRequestsTab(document.getElementById('tab-content'));
      if (action === 'accept') {
          await loadPage(); // Full reload to show new member
      }
    } else {
      Toast.error(res.message || 'Action failed.');
      if (btn) btn.disabled = false;
    }
  } catch {
    Toast.error('Network error.');
    if (btn) btn.disabled = false;
  }
}


// ─── RULES TAB ────────────────────────────────────────────────
function renderRulesTab(el) {
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">

      <div class="card">
        <div class="cw-section-title" style="margin-bottom:14px"><i class="fa-solid fa-calendar-week"></i> Weekly Schedule</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-secondary)">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <span><strong style="color:var(--gold)">War 1</strong></span><span>Monday – Tuesday (48h)</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <span><strong style="color:var(--gold)">War 2</strong></span><span>Thursday – Friday (48h)</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <span><strong style="color:var(--accent-light)">Results</strong></span><span>Wednesday & Saturday</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0">
            <span><strong style="color:var(--success)">Practice</strong></span><span>Sunday (no penalty)</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="cw-section-title" style="margin-bottom:14px"><i class="fa-solid fa-users-gear"></i> Clan Structure</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-secondary)">
          <div style="padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <span class="role-badge leader" style="margin-right:8px">Leader</span> Full control — 1 per clan
          </div>
          <div style="padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <span class="role-badge co_leader" style="margin-right:8px">Co-Leader</span> Manage wars — max 7
          </div>
          <div style="padding:8px 0">
            <span class="role-badge member" style="margin-right:8px">Member</span> Participate in wars
          </div>
          <div style="padding-top:8px;color:var(--text-muted);font-size:12px">Max clan size: 20 players · Max 16 per war</div>
        </div>
      </div>

      <div class="card" style="grid-column:1/-1">
        <div class="cw-section-title" style="margin-bottom:14px"><i class="fa-solid fa-star"></i> Scoring System</div>
        <table class="scoring-table">
          <thead>
            <tr><th>Scenario</th><th>Player A</th><th>Player B</th></tr>
          </thead>
          <tbody>
            <tr><td>Win / Loss</td><td class="pts-pos">+40</td><td class="pts-zero">0</td></tr>
            <tr><td>Valid Draw (≥ 12 moves)</td><td class="pts-pos">+10</td><td class="pts-pos">+10</td></tr>
            <tr><td>Invalid Draw (&lt; 12 moves)</td><td class="pts-zero">0</td><td class="pts-zero">0</td></tr>
            <tr><td>Disconnect / Forfeit</td><td class="pts-neg">−20</td><td class="pts-pos">+40</td></tr>
            <tr><td>No-Show (2 min timeout)</td><td class="pts-neg">−20</td><td class="pts-pos">+40</td></tr>
            <tr><td>3rd Disconnect</td><td class="pts-neg">−20</td><td class="pts-pos">+40</td></tr>
          </tbody>
        </table>
        <div style="margin-top:12px;font-size:12px;color:var(--text-muted)">
          <i class="fa-solid fa-circle-info" style="color:var(--gold)"></i>
          Reconnect window: <strong>120 seconds</strong> · Max reconnects per match: <strong>2</strong> · Lineup locked once war begins
        </div>
      </div>

    </div>`;
}

// ─── LEADERBOARD VIEW ─────────────────────────────────────────
async function renderLeaderboardView() {
  document.getElementById('page-content').innerHTML =
    '<div class="cw-loading"><div class="spinner"></div><p>Loading Leaderboard...</p></div>';
  try {
    const res = await ClanAPI.getLeaderboard();
    const clans = res.clans || [];
    document.getElementById('page-content').innerHTML = `
      <div class="cw-section-header">
        <div class="cw-section-title"><i class="fa-solid fa-trophy"></i> Clan Leaderboard</div>
        <button class="btn btn-ghost btn-sm" onclick="loadPage()"><i class="fa-solid fa-arrow-left"></i> Back</button>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <table class="cw-lb-table">
          <thead>
            <tr><th>#</th><th>Clan</th><th>Members</th><th>Wars</th><th>Wins</th><th>Win Rate</th></tr>
          </thead>
          <tbody>
            ${clans.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">No clans yet. Be the first!</td></tr>` :
              clans.map((c, i) => {
                const wr = c.total_wars > 0 ? Math.round((c.war_wins/c.total_wars)*100) : 0;
                const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
                const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
                return `
                  <tr>
                    <td><div class="lb-rank-num ${rankClass}">${medal||i+1}</div></td>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px">
                        <div class="clan-card-tag" style="width:36px;height:36px;font-size:11px;border-radius:8px">${esc(c.tag)}</div>
                        <div>
                          <div style="font-weight:700;color:var(--text-primary)">${esc(c.name)}</div>
                          <div style="font-size:11px;color:var(--text-muted)">[${esc(c.tag)}]</div>
                        </div>
                      </div>
                    </td>
                    <td>${c.total_members}</td>
                    <td>${c.total_wars}</td>
                    <td style="color:var(--gold);font-weight:700">${c.war_wins}</td>
                    <td>${wr}%</td>
                  </tr>`;
              }).join('')
            }
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    Toast.error('Failed to load leaderboard.');
    loadPage();
  }
}

// ─── PENDING WARS ─────────────────────────────────────────────
async function loadPendingWars() {
  const container = document.getElementById('pending-wars-container');
  if (!container) return;
  try {
    const res = await ClanAPI.getPendingWars();
    const wars = res.wars || [];
    if (wars.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = wars.map(w => `
      <div class="pending-war-alert">
        <i class="fa-solid fa-bell"></i>
        <div class="pending-war-alert-text">
          <div class="pending-war-alert-title">War Challenge from [${esc(w.clan_a?.tag||'?')}] ${esc(w.clan_a?.name||'Unknown')}</div>
          <div class="pending-war-alert-sub">Declared ${fmt.relTime(w.created_at)}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="acceptWar('${w.id}')">Accept War</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="declineWar('${w.id}')">Decline</button>
      </div>`).join('');
  } catch {}
}

async function acceptWar(warId) {
  const btn = event?.target?.closest('button');
  if (btn) { btn.disabled = true; btn.textContent = 'Accepting...'; }
  const res = await ClanAPI.acceptWar(warId);
  if (res.success) { Toast.success('War accepted! Battle begins.'); await loadPage(); }
  else {
    Toast.error(res.message || 'Failed to accept war.');
    if (btn) { btn.disabled = false; btn.textContent = 'Accept War'; }
  }
}

async function declineWar(warId) {
  // No dedicated endpoint — just reload (war will expire)
  Toast.info('War declined.');
  await loadPage();
}

// ─── WAR HISTORY MODAL ────────────────────────────────────────
async function openWarHistoryModal() {
  // Guard: modal only exists in clan dashboard view
  const modal = document.getElementById('war-history-modal');
  if (!modal) { Toast.info('Join a clan to view war history.'); return; }
  openModal('war-history-modal');
  const body = document.getElementById('war-history-body');
  if (!body) return;
  body.innerHTML = '<div class="cw-loading"><div class="spinner"></div></div>';
  try {
    const res = await ClanAPI.getWarHistory();
    const wars = res.wars || [];
    if (wars.length === 0) {
      body.innerHTML = '<div class="cw-empty"><i class="fa-solid fa-clock-rotate-left"></i><p>No war history yet.</p></div>';
      return;
    }
    body.innerHTML = wars.map(w => {
      const isA = w.clan_a_id === myClan.id;
      const opp = isA ? w.clan_b : w.clan_a;
      const myScore  = isA ? w.score_a : w.score_b;
      const oppScore = isA ? w.score_b : w.score_a;
      let outcome = 'draw';
      if (w.winner_clan_id === myClan.id) outcome = 'win';
      else if (w.winner_clan_id && w.winner_clan_id !== myClan.id) outcome = 'loss';
      const outcomeLabel = outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'D';
      return `
        <div class="war-history-card">
          <div class="war-history-result ${outcome}">${outcomeLabel}</div>
          <div class="war-history-info">
            <div class="war-history-vs">vs [${esc(opp?.tag||'?')}] ${esc(opp?.name||'Unknown')}</div>
            <div class="war-history-meta">${fmt.time(w.end_time)}</div>
          </div>
          <div class="war-history-score">${myScore} – ${oppScore}</div>
        </div>`;
    }).join('');
  } catch { body.innerHTML = '<div class="cw-empty"><p>Failed to load history.</p></div>'; }
}

function warHistoryModal() {
  return `
    <div class="cw-modal-overlay" id="war-history-modal">
      <div class="cw-modal">
        <div class="cw-modal-header">
          <div class="cw-modal-title"><i class="fa-solid fa-clock-rotate-left" style="color:var(--gold);margin-right:8px"></i>War History</div>
          <button class="cw-modal-close" onclick="closeModal('war-history-modal')"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="war-history-body"></div>
      </div>
    </div>`;
}

// ─── CREATE CLAN MODAL ────────────────────────────────────────
function createClanModal() {
  return `
    <div class="cw-modal-overlay" id="create-clan-modal">
      <div class="cw-modal">
        <div class="cw-modal-header">
          <div class="cw-modal-title"><i class="fa-solid fa-shield-halved" style="color:var(--gold);margin-right:8px"></i>Create Clan</div>
          <button class="cw-modal-close" onclick="closeModal('create-clan-modal')"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="cw-form-group">
          <label class="cw-form-label">Clan Name <span style="color:var(--error)">*</span></label>
          <input class="cw-form-input" id="clan-name-input"
            placeholder="e.g. Phoenix Warriors"
            maxlength="32"
            oninput="cwValidateName(this)">
          <div class="cw-form-hint" id="clan-name-hint">3–32 characters</div>
        </div>
        <div class="cw-form-group">
          <label class="cw-form-label">Clan Tag <span style="color:var(--error)">*</span></label>
          <input class="cw-form-input" id="clan-tag-input"
            placeholder="e.g. PHNX"
            maxlength="5"
            style="text-transform:uppercase;letter-spacing:3px;font-weight:700"
            oninput="cwValidateTag(this)">
          <div class="cw-form-hint" id="clan-tag-hint">2–5 letters/numbers, shown as [TAG]</div>
        </div>
        <div class="cw-form-group">
          <label class="cw-form-label">Description <span style="color:var(--text-muted);font-weight:400">(optional)</span></label>
          <input class="cw-form-input" id="clan-desc-input"
            placeholder="Describe your clan..."
            maxlength="120"
            oninput="document.getElementById('clan-desc-count').textContent=this.value.length">
          <div class="cw-form-hint"><span id="clan-desc-count">0</span>/120 characters</div>
        </div>
        <button class="btn btn-primary" id="create-clan-btn" style="width:100%" onclick="submitCreateClan()">
          <i class="fa-solid fa-plus"></i> Create Clan
        </button>
        <div id="create-clan-error" style="display:none;margin-top:12px;padding:10px 14px;background:var(--error-bg);border:1px solid rgba(251,113,133,0.3);border-radius:10px;font-size:13px;color:var(--error)"></div>
      </div>
    </div>`;
}

function openCreateClanModal() {
  openModal('create-clan-modal');
  // Reset form state on open
  setTimeout(() => {
    const nameInput = document.getElementById('clan-name-input');
    const tagInput  = document.getElementById('clan-tag-input');
    const descInput = document.getElementById('clan-desc-input');
    const errBox    = document.getElementById('create-clan-error');
    if (nameInput) nameInput.value = '';
    if (tagInput)  tagInput.value  = '';
    if (descInput) descInput.value = '';
    if (errBox)    { errBox.style.display = 'none'; errBox.textContent = ''; }
    document.getElementById('clan-name-hint')?.setAttribute('style', '');
    document.getElementById('clan-tag-hint')?.setAttribute('style', '');
    document.getElementById('clan-desc-count') && (document.getElementById('clan-desc-count').textContent = '0');
    const btn = document.getElementById('create-clan-btn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Clan'; }
  }, 50);
}

// ── Inline validators ─────────────────────────────────────────
function cwValidateName(input) {
  const hint = document.getElementById('clan-name-hint');
  const v = input.value.trim();
  if (!hint) return;
  if (v.length === 0) {
    hint.style.color = 'var(--text-muted)';
    hint.textContent = '3–32 characters';
  } else if (v.length < 3) {
    hint.style.color = 'var(--error)';
    hint.textContent = `${v.length}/3 minimum — too short`;
  } else {
    hint.style.color = 'var(--success)';
    hint.textContent = `${v.length}/32 ✓`;
  }
}

function cwValidateTag(input) {
  const hint = document.getElementById('clan-tag-hint');
  // Force uppercase as user types
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const v = input.value;
  if (!hint) return;
  if (v.length === 0) {
    hint.style.color = 'var(--text-muted)';
    hint.textContent = '2–5 letters/numbers, shown as [TAG]';
  } else if (v.length < 2) {
    hint.style.color = 'var(--error)';
    hint.textContent = `${v.length}/2 minimum — too short`;
  } else {
    hint.style.color = 'var(--success)';
    hint.textContent = `[${v}] — looks good ✓`;
  }
}

function cwShowError(msg) {
  const errBox = document.getElementById('create-clan-error');
  if (!errBox) { Toast.error(msg); return; }
  errBox.textContent = msg;
  errBox.style.display = 'block';
}

function cwClearError() {
  const errBox = document.getElementById('create-clan-error');
  if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
}

async function submitCreateClan() {
  cwClearError();

  const nameInput = document.getElementById('clan-name-input');
  const tagInput  = document.getElementById('clan-tag-input');
  const descInput = document.getElementById('clan-desc-input');
  const btn       = document.getElementById('create-clan-btn');

  const name = nameInput?.value?.trim() || '';
  const tag  = (tagInput?.value?.trim() || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const desc = descInput?.value?.trim() || '';

  // Client-side validation (mirrors backend)
  if (!name || name.length < 3) {
    cwShowError('Clan name must be at least 3 characters.');
    nameInput?.focus();
    return;
  }
  if (name.length > 32) {
    cwShowError('Clan name must be 32 characters or fewer.');
    nameInput?.focus();
    return;
  }
  if (!tag || tag.length < 2) {
    cwShowError('Tag must be at least 2 characters.');
    tagInput?.focus();
    return;
  }
  if (tag.length > 5) {
    cwShowError('Tag must be 5 characters or fewer.');
    tagInput?.focus();
    return;
  }

  // Disable button and show loading state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
  }

  try {
    const res = await ClanAPI.create({ name, tag, description: desc });

    if (res && res.success) {
      Toast.success('Clan created! Welcome, Leader.');
      closeModal('create-clan-modal');
      await loadPage();
    } else {
      const msg = res?.message || 'Failed to create clan. Please try again.';
      cwShowError(msg);
      // Re-enable button
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Clan';
      }
    }
  } catch (err) {
    console.error('submitCreateClan error:', err);
    cwShowError('Network error. Check your connection and try again.');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Clan';
    }
  }
}

// ─── SEARCH CLAN MODAL ────────────────────────────────────────
function searchClanModal() {
  return `
    <div class="cw-modal-overlay" id="search-clan-modal">
      <div class="cw-modal" style="max-width:560px">
        <div class="cw-modal-header">
          <div class="cw-modal-title"><i class="fa-solid fa-magnifying-glass" style="color:var(--gold);margin-right:8px"></i>Find a Clan</div>
          <button class="cw-modal-close" onclick="closeModal('search-clan-modal')"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="clan-search-bar">
          <input id="clan-search-input" class="cw-form-input" placeholder="Search by name or tag..." oninput="searchClans(this.value)">
        </div>
        <div id="clan-search-results">
          <div class="cw-empty"><i class="fa-solid fa-magnifying-glass"></i><p>Type to search clans</p></div>
        </div>
      </div>
    </div>`;
}

function openSearchClanModal() { openModal('search-clan-modal'); searchClans(''); }

let searchTimeout = null;
function searchClans(q) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const res = await ClanAPI.search(q);
    const clans = res.clans || [];
    const el = document.getElementById('clan-search-results');
    if (!el) return;
    if (clans.length === 0) {
      el.innerHTML = '<div class="cw-empty"><i class="fa-solid fa-users-slash"></i><p>No clans found.</p></div>';
      return;
    }
    el.innerHTML = clans.map(c => `
      <div class="clan-card" onclick="joinClanById('${c.id}','${esc(c.name)}')">
        <div class="clan-card-tag">${esc(c.tag)}</div>
        <div class="clan-card-info">
          <div class="clan-card-name">${esc(c.name)}</div>
          <div class="clan-card-meta">${c.total_members}/20 members · ${c.total_wars||0} wars</div>
        </div>
        <div class="clan-card-stats">
          <div class="clan-card-wins">${c.war_wins||0}</div>
          <div class="clan-card-wins-label">WINS</div>
        </div>
      </div>`).join('');
  }, 300);
}

async function joinClanById(id, name) {
  if (!confirm(`Join clan "${name}"?`)) return;
  const res = await ClanAPI.join(id);
  if (res.success) {
    Toast.success('Joined clan!');
    closeModal('search-clan-modal');
    await loadPage();
  } else {
    Toast.error(res.message || 'Failed to join.');
  }
}

// ─── DECLARE WAR MODAL ────────────────────────────────────────
function declareWarModal() {
  return `
    <div class="cw-modal-overlay" id="declare-war-modal">
      <div class="cw-modal" style="max-width:560px">
        <div class="cw-modal-header">
          <div class="cw-modal-title"><i class="fa-solid fa-khanda" style="color:var(--gold);margin-right:8px"></i>Declare War</div>
          <button class="cw-modal-close" onclick="closeModal('declare-war-modal')"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">Search for a clan to challenge. The war lasts 48 hours once accepted.</p>
        <div class="clan-search-bar">
          <input id="war-target-search" class="cw-form-input" placeholder="Search opponent clan..." oninput="searchWarTargets(this.value)">
        </div>
        <div id="war-target-results">
          <div class="cw-empty"><i class="fa-solid fa-khanda"></i><p>Search for a clan to challenge</p></div>
        </div>
      </div>
    </div>`;
}

function openDeclareWarModal() { openModal('declare-war-modal'); }

let warSearchTimeout = null;
function searchWarTargets(q) {
  clearTimeout(warSearchTimeout);
  warSearchTimeout = setTimeout(async () => {
    const res = await ClanAPI.search(q);
    const clans = (res.clans || []).filter(c => c.id !== myClan.id);
    const el = document.getElementById('war-target-results');
    if (!el) return;
    if (clans.length === 0) {
      el.innerHTML = '<div class="cw-empty"><i class="fa-solid fa-users-slash"></i><p>No clans found.</p></div>';
      return;
    }
    el.innerHTML = clans.map(c => `
      <div class="clan-card" onclick="confirmDeclareWar('${c.id}','${esc(c.name)}','${esc(c.tag)}')">
        <div class="clan-card-tag">${esc(c.tag)}</div>
        <div class="clan-card-info">
          <div class="clan-card-name">${esc(c.name)}</div>
          <div class="clan-card-meta">${c.total_members} members · ${c.war_wins||0} war wins</div>
        </div>
        <button class="btn btn-primary btn-sm" style="pointer-events:none">Challenge</button>
      </div>`).join('');
  }, 300);
}

async function confirmDeclareWar(id, name, tag) {
  if (!confirm(`Declare war on [${tag}] ${name}? They have 48 hours to accept.`)) return;
  const res = await ClanAPI.declareWar(id);
  if (res.success) {
    Toast.success('War declared! Waiting for opponent to accept.');
    closeModal('declare-war-modal');
    await loadPage();
  } else {
    Toast.error(res.message || 'Failed to declare war.');
  }
}

// ─── LINEUP MODAL ─────────────────────────────────────────────
function lineupModal() {
  return `
    <div class="cw-modal-overlay" id="lineup-modal">
      <div class="cw-modal" style="max-width:600px">
        <div class="cw-modal-header">
          <div class="cw-modal-title"><i class="fa-solid fa-list-check" style="color:var(--gold);margin-right:8px"></i>Set War Lineup</div>
          <button class="cw-modal-close" onclick="closeModal('lineup-modal')"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">Select up to 16 players for the war. Lineup locks once war begins.</p>
        <div class="lineup-count">Selected: <span id="lineup-count-val">0</span>/16</div>
        <div class="lineup-grid" id="lineup-grid" style="margin-top:12px"></div>
        <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="submitLineup()">
          <i class="fa-solid fa-check"></i> Confirm Lineup
        </button>
      </div>
    </div>`;
}

function openLineupModal() {
  if (!myWar) return Toast.warning('No active war to set lineup for.');
  if (myWar.status !== 'pending') return Toast.warning('Lineup can only be set before war starts.');
  selectedLineup.clear();
  openModal('lineup-modal');
  renderLineupGrid();
}

function renderLineupGrid() {
  const grid = document.getElementById('lineup-grid');
  if (!grid) return;
  const members = myClan.members || [];
  grid.innerHTML = members.map(m => {
    const p = m.profiles || {};
    const name = p.username || 'Unknown';
    const av = p.profile_image ? `<img src="${p.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : name[0]?.toUpperCase();
    const sel = selectedLineup.has(p.id);
    return `
      <div class="lineup-player-card ${sel?'selected':''}" id="lp-${p.id}" onclick="toggleLineupPlayer('${p.id}')">
        <div class="lineup-check">${sel?'<i class="fa-solid fa-check"></i>':''}</div>
        <div class="wmc-avatar" style="margin:0 auto 6px">${av}</div>
        <div style="font-size:12px;color:var(--text-secondary);text-align:center">${esc(name)}</div>
        <div style="font-size:10px;color:var(--text-muted);text-align:center">IQ ${p.iq_level||100}</div>
      </div>`;
  }).join('');
}

function toggleLineupPlayer(userId) {
  if (selectedLineup.has(userId)) {
    selectedLineup.delete(userId);
  } else {
    if (selectedLineup.size >= 16) return Toast.warning('Max 16 players per war.');
    selectedLineup.add(userId);
  }
  document.getElementById('lineup-count-val').textContent = selectedLineup.size;
  renderLineupGrid();
}

async function submitLineup() {
  if (!myWar) return Toast.warning('No active war.');
  if (selectedLineup.size === 0) return Toast.warning('Select at least 1 player.');
  const btn = document.querySelector('#lineup-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }
  const res = await ClanAPI.setLineup({ warId: myWar.id, playerIds: [...selectedLineup] });
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Lineup'; }
  if (res.success) {
    Toast.success('Lineup set!');
    closeModal('lineup-modal');
    await loadPage();
  } else {
    Toast.error(res.message || 'Failed to set lineup.');
  }
}

// ─── MEMBER MANAGEMENT ────────────────────────────────────────
async function promoteToCoLeader(userId, name) {
  if (!confirm(`Promote ${name} to Co-Leader?`)) return;
  const res = await ClanAPI.updateRole({ targetUserId: userId, role: 'co_leader' });
  if (res.success) { Toast.success('Promoted!'); await loadPage(); }
  else Toast.error(res.message || 'Failed.');
}

async function demoteToMember(userId, name) {
  if (!confirm(`Demote ${name} to Member?`)) return;
  const res = await ClanAPI.updateRole({ targetUserId: userId, role: 'member' });
  if (res.success) { Toast.success('Demoted.'); await loadPage(); }
  else Toast.error(res.message || 'Failed.');
}

async function kickMember(userId, name) {
  if (!confirm(`Kick ${name} from the clan?`)) return;
  const res = await ClanAPI.kickMember(userId);
  if (res.success) { Toast.success('Member kicked.'); await loadPage(); }
  else Toast.error(res.message || 'Failed.');
}

async function confirmLeaveClan() {
  if (!confirm('Leave your clan? You will lose your role and war progress.')) return;
  const res = await ClanAPI.leave();
  if (res.success) { Toast.success('Left clan.'); myClan = null; myWar = null; renderNoClan(); }
  else Toast.error(res.message || 'Failed to leave.');
}

async function confirmDeleteClan() {
  if (myClan.total_members > 1) {
    Toast.error('You must kick all members before deleting the clan.');
    return;
  }
  if (!confirm('Are you absolutely sure you want to DELETE this clan? This action cannot be undone.')) return;
  const res = await ClanAPI.delete();
  if (res.success) {
    Toast.success('Clan deleted.');
    myClan = null;
    myWar = null;
    renderNoClan();
  } else {
    Toast.error(res.message || 'Failed to delete clan.');
  }
}

async function confirmTransferLeadership(userId, name) {
  if (!confirm(`Transfer clan leadership to ${name}? You will become a Co-Leader and cannot undo this action.`)) return;
  const res = await ClanAPI.transferLeadership(userId);
  if (res.success) {
    Toast.success('Leadership transferred!');
    await loadPage();
  } else {
    Toast.error(res.message || 'Failed to transfer leadership.');
  }
}

async function openInviteMemberPrompt() {
  const username = prompt('Enter player @username to invite:');
  if (!username) return;
  
  const cleanUsername = username.trim();
  if (!cleanUsername) return;

  const res = await ClanAPI.inviteMember(cleanUsername);
  if (res.success) {
    Toast.success('Invitation sent to ' + cleanUsername);
  } else {
    Toast.error(res.message || 'Failed to send invitation.');
  }
}

// ─── MODAL HELPERS ────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    // Focus first input in modal for accessibility
    setTimeout(() => {
      const first = el.querySelector('input:not([disabled])');
      if (first) first.focus();
    }, 100);
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    // Clear error box if present
    const errBox = el.querySelector('[id$="-error"]');
    if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
  }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('cw-modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Submit create-clan form on Enter key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const modal = document.getElementById('create-clan-modal');
    if (modal && modal.classList.contains('open')) {
      e.preventDefault();
      submitCreateClan();
    }
  }
  if (e.key === 'Escape') {
    // Close any open modal
    document.querySelectorAll('.cw-modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ─── UTILITY HELPERS ──────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getRoleLabel(role) {
  return { leader: 'Leader', co_leader: 'Co-Leader', member: 'Member' }[role] || role;
}

function getTimeLeft(endTime) {
  if (!endTime) return 'N/A';
  const diff = new Date(endTime) - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h/24)}d ${h%24}h`;
  return `${h}h ${m}m`;
}

