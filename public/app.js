/* Arcade Command Center UI.
 *
 * Renders Headquarters at the centre of a canvas map with each division as a
 * surrounding building. Buildings are clickable to inspect agents and issue
 * orders. Pending approvals and recent orders are polled from the backend API.
 *
 * The map renders even without a backend (open the folder directly): the org
 * chart falls back to a bundled copy, and API-backed actions light up once the
 * server at /api/command-center is reachable.
 */
(function () {
  'use strict';

  var API = '/api/command-center';

  // Fallback org chart mirrors src/domain/organization.ts so the map draws even
  // when opened directly from disk without the server running.
  var FALLBACK = {
    hq: {
      id: 'hq',
      name: 'Headquarters',
      role: 'Command & control — you issue the orders here',
      color: '#ffd447',
      position: { x: 0, y: 0 },
    },
    divisions: [
      { id: 'software', name: 'Software Development', mission: 'Build and ship the software that runs the business.', color: '#4fc3f7', position: { x: 0, y: -1 }, agents: [{ id: 'sw-architect', name: 'Architect', role: 'Designs systems and turns HQ orders into build specs' }, { id: 'sw-builder', name: 'Builder', role: 'Implements features and integrations' }, { id: 'sw-shipper', name: 'Shipper', role: 'Packages and deploys releases' }] },
      { id: 'qa', name: 'Error Correction (QA)', mission: 'Detect, triage and fix errors before customers do.', color: '#ef5350', position: { x: 1, y: -0.4 }, agents: [{ id: 'qa-watcher', name: 'Watcher', role: 'Monitors logs and health for anomalies' }, { id: 'qa-triage', name: 'Triage', role: 'Reproduces and prioritises defects' }, { id: 'qa-fixer', name: 'Fixer', role: 'Patches bugs and verifies regressions' }] },
      { id: 'social', name: 'Social Media', mission: 'Grow and engage the audience across social channels.', color: '#ab47bc', position: { x: 0.7, y: 0.9 }, agents: [{ id: 'so-creator', name: 'Creator', role: 'Drafts posts, reels and community replies' }, { id: 'so-scheduler', name: 'Scheduler', role: 'Plans and publishes the content calendar' }, { id: 'so-listener', name: 'Listener', role: 'Tracks mentions, trends and sentiment' }] },
      { id: 'marketing', name: 'Marketing', mission: 'Drive demand through campaigns, ads and SEO.', color: '#66bb6a', position: { x: -0.7, y: 0.9 }, agents: [{ id: 'mk-strategist', name: 'Strategist', role: 'Sets campaign goals and budgets' }, { id: 'mk-copywriter', name: 'Copywriter', role: 'Writes ad and landing-page copy' }, { id: 'mk-analyst', name: 'Analyst', role: 'Measures ROI and optimises spend' }] },
      { id: 'operations', name: 'Operations', mission: 'Keep fulfilment, inventory and finances running smoothly.', color: '#ffa726', position: { x: -1, y: -0.4 }, agents: [{ id: 'op-buyer', name: 'Buyer', role: 'Sources products and proposes purchases' }, { id: 'op-fulfiller', name: 'Fulfiller', role: 'Processes orders and tracking' }, { id: 'op-treasurer', name: 'Treasurer', role: 'Watches cash flow and flags spend' }] },
    ],
  };

  var canvas = document.getElementById('map');
  var ctx = canvas.getContext('2d');
  var W = canvas.width;
  var H = canvas.height;

  var state = {
    org: FALLBACK,
    online: false,
    selected: 'hq',
    buildings: [], // { id, name, color, cx, cy, r, kind }
    approvals: [],
    commands: [],
    frame: 0,
  };

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function api(path, options) {
    var res = await fetch(API + path, options);
    if (!res.ok) {
      var msg = 'HTTP ' + res.status;
      try {
        var body = await res.json();
        if (body && body.error) msg = body.error;
      } catch (e) {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  }

  function setConnection(online) {
    state.online = online;
    var badge = el('connection');
    badge.textContent = online ? 'online' : 'offline';
    badge.className = 'badge ' + (online ? 'badge--online' : 'badge--offline');
  }

  /* ---- Layout & rendering ---- */

  function computeBuildings() {
    var cx = W / 2;
    var cy = H / 2;
    var scale = Math.min(W, H) * 0.32;
    var list = [
      { id: 'hq', name: state.org.hq.name, color: state.org.hq.color, pos: state.org.hq.position, kind: 'hq' },
    ];
    state.org.divisions.forEach(function (d) {
      list.push({ id: d.id, name: d.name, color: d.color, pos: d.position, kind: 'division' });
    });
    state.buildings = list.map(function (b) {
      return {
        id: b.id,
        name: b.name,
        color: b.color,
        kind: b.kind,
        cx: cx + b.pos.x * scale,
        cy: cy + b.pos.y * scale,
        r: b.kind === 'hq' ? 46 : 36,
      };
    });
  }

  function drawGrid() {
    ctx.fillStyle = '#0b0f1f';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1d2846';
    ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (var y = 0; y <= H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawConnections(hq) {
    state.buildings.forEach(function (b) {
      if (b.kind === 'hq') return;
      ctx.strokeStyle = 'rgba(255, 212, 71, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -state.frame * 0.5;
      ctx.beginPath();
      ctx.moveTo(hq.cx, hq.cy);
      ctx.lineTo(b.cx, b.cy);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  function drawBuilding(b) {
    var selected = b.id === state.selected;
    // base glow
    ctx.save();
    ctx.shadowColor = b.color;
    ctx.shadowBlur = selected ? 24 : 10;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.cx - b.r, b.cy - b.r, b.r * 2, b.r * 2);
    ctx.restore();

    // inner
    ctx.fillStyle = '#0b0f1f';
    ctx.fillRect(b.cx - b.r + 5, b.cy - b.r + 5, b.r * 2 - 10, b.r * 2 - 10);

    // roof label
    ctx.fillStyle = b.color;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    var label = b.kind === 'hq' ? 'HQ' : b.name.split(' ')[0].toUpperCase();
    ctx.fillText(label, b.cx, b.cy + 4);

    if (selected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.cx - b.r - 3, b.cy - b.r - 3, b.r * 2 + 6, b.r * 2 + 6);
    }

    // orbiting agent bots
    var division = findDivision(b.id);
    var agents = division ? division.agents : [];
    var count = b.kind === 'hq' ? 1 : agents.length;
    for (var i = 0; i < count; i++) {
      var ang = state.frame * 0.02 + (i / Math.max(count, 1)) * Math.PI * 2;
      var orbit = b.r + 16;
      var ox = b.cx + Math.cos(ang) * orbit;
      var oy = b.cy + Math.sin(ang) * orbit;
      ctx.fillStyle = b.kind === 'hq' ? '#ffd447' : '#e8ecff';
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // approval alert marker
    var pending = state.approvals.filter(function (a) {
      return a.division_id === b.id && a.status === 'pending';
    }).length;
    if (pending > 0) {
      ctx.fillStyle = '#ef5350';
      ctx.beginPath();
      ctx.arc(b.cx + b.r, b.cy - b.r, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillText(String(pending), b.cx + b.r, b.cy - b.r + 4);
    }
  }

  function render() {
    state.frame++;
    drawGrid();
    var hq = state.buildings.find(function (b) {
      return b.kind === 'hq';
    });
    if (hq) drawConnections(hq);
    state.buildings.forEach(drawBuilding);
    requestAnimationFrame(render);
  }

  /* ---- Data helpers ---- */

  function findDivision(id) {
    if (id === 'hq') return null;
    return state.org.divisions.find(function (d) {
      return d.id === id;
    });
  }

  function populateDivisionSelect() {
    var sel = el('order-division');
    sel.innerHTML = '';
    state.org.divisions.forEach(function (d) {
      var opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      sel.appendChild(opt);
    });
  }

  function renderSelection() {
    var id = state.selected;
    var title = el('selection-title');
    var mission = el('selection-mission');
    var agentList = el('agent-list');
    agentList.innerHTML = '';

    if (id === 'hq') {
      title.textContent = state.org.hq.name;
      mission.textContent = state.org.hq.role;
      return;
    }
    var d = findDivision(id);
    if (!d) return;
    title.textContent = d.name;
    mission.textContent = d.mission;
    d.agents.forEach(function (a) {
      var li = document.createElement('li');
      li.innerHTML = '<strong>' + escapeHtml(a.name) + '</strong><span>' + escapeHtml(a.role) + '</span>';
      agentList.appendChild(li);
    });
    el('order-division').value = id;
  }

  function renderApprovals() {
    var list = el('approval-list');
    var pending = state.approvals.filter(function (a) {
      return a.status === 'pending';
    });
    el('approval-count').textContent = String(pending.length);
    list.innerHTML = '';
    if (!state.online) {
      list.innerHTML = '<li class="muted small">Start the server to manage approvals.</li>';
      return;
    }
    if (pending.length === 0) {
      list.innerHTML = '<li class="muted small">No pending approvals. 🎉</li>';
      return;
    }
    pending.forEach(function (a) {
      var li = document.createElement('li');
      var amount = a.amount != null ? ' · ' + a.amount + (a.currency ? ' ' + a.currency : '') : '';
      var kind = a.kind === 'purchase' ? '💳 Purchase' : '🧭 Course change';
      li.innerHTML =
        '<div><b>' + escapeHtml(a.summary) + '</b></div>' +
        '<div class="approval-meta">' + kind + ' · ' + escapeHtml(a.division_id) + amount + '</div>' +
        '<div class="approval-actions">' +
        '<button class="ok" data-approve="' + a.id + '">Approve</button>' +
        '<button class="danger" data-reject="' + a.id + '">Reject</button>' +
        '</div>';
      list.appendChild(li);
    });
  }

  function renderCommands() {
    var log = el('command-log');
    log.innerHTML = '';
    if (!state.online) {
      log.innerHTML = '<li class="muted small">Start the server to issue and track orders.</li>';
      return;
    }
    if (state.commands.length === 0) {
      log.innerHTML = '<li class="muted small">No orders issued yet.</li>';
      return;
    }
    state.commands.slice(0, 8).forEach(function (c) {
      var li = document.createElement('li');
      li.innerHTML = '<b>' + escapeHtml(c.division_id) + '</b> — ' + escapeHtml(c.instruction);
      log.appendChild(li);
    });
  }

  /* ---- API interactions ---- */

  async function loadOrganization() {
    try {
      var data = await api('/organization');
      state.org = data;
      setConnection(true);
    } catch (e) {
      state.org = FALLBACK;
      setConnection(false);
    }
    computeBuildings();
    populateDivisionSelect();
    renderSelection();
  }

  async function refresh() {
    if (!state.online) return;
    try {
      var a = await api('/approvals');
      state.approvals = a.approvals || [];
      var c = await api('/commands');
      state.commands = c.commands || [];
      renderApprovals();
      renderCommands();
    } catch (e) {
      setConnection(false);
    }
  }

  async function sendOrder() {
    var status = el('order-status');
    var divisionId = el('order-division').value;
    var instruction = el('order-instruction').value.trim();
    if (!instruction) {
      status.textContent = 'Enter an instruction first.';
      status.className = 'status err';
      return;
    }
    try {
      await api('/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ divisionId: divisionId, instruction: instruction }),
      });
      status.textContent = 'Order dispatched to ' + divisionId + '.';
      status.className = 'status ok';
      el('order-instruction').value = '';
      refresh();
    } catch (e) {
      status.textContent = 'Failed: ' + e.message;
      status.className = 'status err';
    }
  }

  async function decide(id, decision) {
    try {
      await api('/approvals/' + id + '/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: decision }),
      });
      refresh();
    } catch (e) {
      /* surfaced via reconnection */
    }
  }

  /* ---- Events ---- */

  canvas.addEventListener('click', function (evt) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = W / rect.width;
    var scaleY = H / rect.height;
    var mx = (evt.clientX - rect.left) * scaleX;
    var my = (evt.clientY - rect.top) * scaleY;
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (mx >= b.cx - b.r && mx <= b.cx + b.r && my >= b.cy - b.r && my <= b.cy + b.r) {
        state.selected = b.id;
        renderSelection();
        return;
      }
    }
  });

  el('order-send').addEventListener('click', sendOrder);

  el('approval-list').addEventListener('click', function (evt) {
    var t = evt.target;
    if (t.dataset && t.dataset.approve) decide(t.dataset.approve, 'approved');
    if (t.dataset && t.dataset.reject) decide(t.dataset.reject, 'rejected');
  });

  /* ---- Boot ---- */

  loadOrganization().then(function () {
    renderApprovals();
    renderCommands();
    refresh();
    setInterval(refresh, 4000);
  });
  requestAnimationFrame(render);
})();
