/**
 * Renders the Virtual Office dashboard as a single self-contained HTML
 * document (inline CSS + JS, no external assets). Returned verbatim from
 * `GET /virtual-office/` — see `src/routes/virtualOffice.ts`.
 */
export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Virtual Office — Agent Activity</title>
<style>
  :root {
    --bg: #0f1b2d;
    --bg-grid: #16263c;
    --panel: #16263f;
    --accent: #5b9bd5;
    --green: #4caf82;
    --red: #d9695f;
    --dim: #7c8ba3;
    --text: #eef2f7;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    height: 100%;
    background-color: var(--bg);
    background-image:
      linear-gradient(var(--bg-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--bg-grid) 1px, transparent 1px);
    background-size: 32px 32px;
    color: var(--text);
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 2px solid var(--accent);
    background: rgba(0, 0, 0, 0.2);
  }
  h1 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.5px;
    color: var(--text);
    font-weight: 600;
  }
  h1 .sub {
    font-weight: 400;
    color: var(--dim);
    font-size: 13px;
    margin-left: 8px;
  }
  #link-badge {
    font-size: 11px;
    letter-spacing: 1px;
    padding: 4px 12px;
    border-radius: 12px;
    border: 1px solid var(--dim);
    text-transform: uppercase;
    font-weight: 600;
  }
  #link-badge.live {
    color: var(--green);
    border-color: var(--green);
  }
  #link-badge.lost {
    color: var(--red);
    border-color: var(--red);
  }
  #office-floor {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 24px;
  }
  #empty-state {
    color: var(--dim);
    padding: 12px 4px;
  }
  .desk {
    width: 220px;
    padding: 14px;
    background: var(--panel);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.35s ease, transform 0.35s ease, filter 0.6s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .desk.seated {
    opacity: 1;
    transform: translateY(0);
  }
  .desk.status-done, .desk.status-error {
    filter: grayscale(0.6);
    opacity: 0.6;
  }
  .desk-top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .avatar {
    width: 30px;
    height: 30px;
    flex: none;
    border-radius: 50%;
  }
  .status-running .avatar { animation: nod 1.4s ease-in-out infinite; }
  .status-error .avatar { animation: alert 0.9s ease-in-out infinite; }
  .name {
    font-weight: 600;
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
    letter-spacing: 0.5px;
  }
  .status-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--dim);
  }
  .badge {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--dim);
    flex: none;
  }
  .status-spawning .badge { background: var(--accent); }
  .status-running .badge { background: var(--green); animation: pulse 1.2s ease-in-out infinite; }
  .status-done .badge { background: var(--dim); }
  .status-error .badge { background: var(--red); }
  .task {
    margin-top: 8px;
    font-size: 11.5px;
    color: var(--text);
    overflow: hidden;
    white-space: nowrap;
    position: relative;
    height: 15px;
  }
  .task span {
    display: inline-block;
  }
  .task.overflow span {
    animation: ticker 6s linear infinite;
  }
  @keyframes nod {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes alert {
    0%, 100% { box-shadow: 0 0 0 rgba(217, 105, 95, 0); }
    50% { box-shadow: 0 0 6px rgba(217, 105, 95, 0.7); }
  }
  @keyframes ticker {
    0% { transform: translateX(0); }
    100% { transform: translateX(-100%); }
  }
</style>
</head>
<body>
<header>
  <h1>Virtual Office<span class="sub">Live Agent Activity</span></h1>
  <div id="link-badge" class="lost">Connecting…</div>
</header>
<main id="office-floor">
  <div id="empty-state">No agents at their desks right now. Standing by for new assignments.</div>
</main>
<script>
(function () {
  var STATUS_LABELS = {
    spawning: 'Onboarding',
    running: 'Active',
    done: 'Completed',
    error: 'Needs Attention',
  };

  var floor = document.getElementById('office-floor');
  var emptyState = document.getElementById('empty-state');
  var linkBadge = document.getElementById('link-badge');
  var cards = new Map();

  function avatarSvg(status) {
    var fill = status === 'error' ? '#d9695f' : (status === 'done' ? '#7c8ba3' : '#5b9bd5');
    return '<svg class="avatar" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="16" cy="16" r="16" fill="#233252"/>' +
      '<circle cx="16" cy="12" r="6" fill="' + fill + '"/>' +
      '<path d="M4 30c0-7 5-11 12-11s12 4 12 11" fill="' + fill + '" opacity="0.85"/>' +
      '</svg>';
  }

  function render(agent) {
    var isNew = !cards.has(agent.id);
    var el = cards.get(agent.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'desk';
      floor.appendChild(el);
      cards.set(agent.id, el);
    }

    var label = STATUS_LABELS[agent.status] || agent.status;
    el.className = 'desk status-' + agent.status;
    el.innerHTML =
      '<div class="desk-top">' +
        avatarSvg(agent.status) +
        '<div><div class="name">' + escapeHtml(agent.name) + '</div>' +
        '<div class="role">' + escapeHtml(agent.role) + '</div></div>' +
      '</div>' +
      '<div class="status-line"><span class="badge"></span><span>' + escapeHtml(label) + '</span></div>' +
      '<div class="task"><span>' + escapeHtml(agent.action) + '</span></div>';

    var taskEl = el.querySelector('.task');
    var span = taskEl.querySelector('span');
    if (span.scrollWidth > taskEl.clientWidth) {
      taskEl.classList.add('overflow');
    }

    emptyState.style.display = 'none';
    if (isNew) {
      requestAnimationFrame(function () {
        el.classList.add('seated');
      });
    } else {
      el.classList.add('seated');
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

  var source = new EventSource('/virtual-office/events');
  source.onopen = function () {
    linkBadge.textContent = 'Live';
    linkBadge.className = 'live';
  };
  source.onerror = function () {
    linkBadge.textContent = 'Disconnected';
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
