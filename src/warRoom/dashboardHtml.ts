/**
 * Renders the War Room dashboard as a single self-contained HTML document
 * (inline CSS + JS, no external assets). Returned verbatim from
 * `GET /war-room/` — see `src/routes/warRoom.ts`.
 */
export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>War Room — Subagent Ops</title>
<style>
  :root {
    --bg: #1b1f16;
    --bg-grid: #23281c;
    --panel: #262b1f;
    --amber: #d7b56d;
    --green: #7cbf6a;
    --red: #c85a4a;
    --dim: #6b7263;
    --text: #e8e4d6;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    height: 100%;
    background-color: var(--bg);
    background-image:
      linear-gradient(var(--bg-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--bg-grid) 1px, transparent 1px);
    background-size: 28px 28px;
    color: var(--text);
    font-family: 'Courier New', Courier, monospace;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 2px solid var(--amber);
    background: rgba(0, 0, 0, 0.25);
  }
  h1 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 3px;
    color: var(--amber);
    text-transform: uppercase;
  }
  #link-badge {
    font-size: 12px;
    letter-spacing: 2px;
    padding: 4px 10px;
    border: 1px solid var(--dim);
    text-transform: uppercase;
  }
  #link-badge.live {
    color: var(--green);
    border-color: var(--green);
    animation: pulse 1.6s ease-in-out infinite;
  }
  #link-badge.lost {
    color: var(--red);
    border-color: var(--red);
  }
  #battlefield {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 24px;
  }
  #empty-state {
    color: var(--dim);
    letter-spacing: 1px;
    padding: 12px 4px;
  }
  .unit {
    width: 200px;
    padding: 12px;
    background: var(--panel);
    border: 1px solid var(--dim);
    border-radius: 2px;
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.4s ease, transform 0.4s ease, filter 0.6s ease;
  }
  .unit.marching-in {
    opacity: 1;
    transform: translateY(0);
  }
  .unit.status-done, .unit.status-error {
    filter: grayscale(0.8);
    opacity: 0.55;
  }
  .unit-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sprite {
    width: 28px;
    height: 28px;
    flex: none;
    shape-rendering: crispEdges;
  }
  .status-running .sprite { animation: bob 1s ease-in-out infinite; }
  .status-error .sprite { animation: flash 0.8s steps(2, jump-none) infinite; }
  .name {
    font-weight: bold;
    font-size: 13px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .role {
    font-size: 10px;
    color: var(--dim);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .status-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dim);
    flex: none;
  }
  .status-spawning .dot { background: var(--amber); }
  .status-running .dot { background: var(--green); animation: pulse 1s ease-in-out infinite; }
  .status-done .dot { background: var(--dim); }
  .status-error .dot { background: var(--red); }
  .orders {
    margin-top: 8px;
    font-size: 11px;
    color: var(--text);
    overflow: hidden;
    white-space: nowrap;
    position: relative;
    height: 14px;
  }
  .orders span {
    display: inline-block;
    padding-left: 0;
  }
  .orders.overflow span {
    animation: marquee 6s linear infinite;
  }
  @keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes flash {
    0%, 100% { filter: drop-shadow(0 0 0 var(--red)); }
    50% { filter: drop-shadow(0 0 4px var(--red)); }
  }
  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-100%); }
  }
</style>
</head>
<body>
<header>
  <h1>War Room &mdash; Claude Code Subagent Ops</h1>
  <div id="link-badge" class="lost">LINK: CONNECTING</div>
</header>
<main id="battlefield">
  <div id="empty-state">No units in the field. Awaiting orders.</div>
</main>
<script>
(function () {
  var battlefield = document.getElementById('battlefield');
  var emptyState = document.getElementById('empty-state');
  var linkBadge = document.getElementById('link-badge');
  var cards = new Map();

  function spriteSvg(status) {
    var body = status === 'error' ? '#c85a4a' : (status === 'done' ? '#6b7263' : '#7cbf6a');
    return '<svg class="sprite" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="3" y="0" width="2" height="2" fill="#4a5240"/>' +
      '<rect x="2" y="2" width="4" height="3" fill="' + body + '"/>' +
      '<rect x="1" y="5" width="2" height="3" fill="#4a5240"/>' +
      '<rect x="5" y="5" width="2" height="3" fill="#4a5240"/>' +
      '</svg>';
  }

  function render(agent) {
    var isNew = !cards.has(agent.id);
    var el = cards.get(agent.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'unit';
      battlefield.appendChild(el);
      cards.set(agent.id, el);
    }

    el.className = 'unit status-' + agent.status;
    el.innerHTML =
      '<div class="unit-top">' +
        spriteSvg(agent.status) +
        '<div><div class="name">' + escapeHtml(agent.name) + '</div>' +
        '<div class="role">' + escapeHtml(agent.role) + '</div></div>' +
      '</div>' +
      '<div class="status-line"><span class="dot"></span><span>' + agent.status + '</span></div>' +
      '<div class="orders"><span>' + escapeHtml(agent.action) + '</span></div>';

    var ordersEl = el.querySelector('.orders');
    var span = ordersEl.querySelector('span');
    if (span.scrollWidth > ordersEl.clientWidth) {
      ordersEl.classList.add('overflow');
    }

    emptyState.style.display = 'none';
    if (isNew) {
      requestAnimationFrame(function () {
        el.classList.add('marching-in');
      });
    } else {
      el.classList.add('marching-in');
    }
  }

  function remove(id) {
    var el = cards.get(id);
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(function () {
      el.remove();
      cards.delete(id);
      if (cards.size === 0) emptyState.style.display = '';
    }, 400);
  }

  function escapeHtml(value) {
    var div = document.createElement('div');
    div.textContent = String(value == null ? '' : value);
    return div.innerHTML;
  }

  var source = new EventSource('/war-room/events');
  source.onopen = function () {
    linkBadge.textContent = 'LINK: LIVE';
    linkBadge.className = 'live';
  };
  source.onerror = function () {
    linkBadge.textContent = 'LINK: LOST';
    linkBadge.className = 'lost';
  };
  source.addEventListener('snapshot', function (event) {
    JSON.parse(event.data).forEach(render);
  });
  source.addEventListener('agent', function (event) {
    render(JSON.parse(event.data));
  });
  source.addEventListener('remove', function (event) {
    remove(JSON.parse(event.data).id);
  });
})();
</script>
</body>
</html>`;
}
