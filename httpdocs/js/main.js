const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const commitMessageEl = document.querySelector('[data-commit-message]');
const commitMetaEl = document.querySelector('[data-commit-meta]');

async function loadLatestCommit(){
  if (!commitMessageEl || !commitMetaEl) return;
  try{
    const response = await fetch('https://api.github.com/repos/Lixias/website/commits?per_page=1', {headers:{Accept:'application/vnd.github+json'}});
    if (!response.ok) throw new Error('GitHub unavailable');
    const commits = await response.json();
    const latest = commits && commits[0];
    if (!latest) throw new Error('No commits returned');
    const hash = latest.sha.slice(0, 7);
    const date = new Date(latest.commit.author.date);
    commitMessageEl.textContent = latest.commit.message.split('\n')[0];
    commitMetaEl.textContent = `Lixias/website · ${hash} · ${date.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}`;
  }catch(error){
    commitMessageEl.textContent = 'Latest site update unavailable';
    commitMetaEl.innerHTML = '<a href="https://github.com/Lixias/website" target="_blank" rel="noopener">View repository on GitHub</a>';
  }
}
loadLatestCommit();

const siteStatsCard = document.querySelector('[data-site-stats-card]');
const siteStatsVisitors = document.querySelector('[data-site-stats-visitors]');
const siteStatsVisits = document.querySelector('[data-site-stats-visits]');
const siteStatsRatio = document.querySelector('[data-site-stats-ratio]');
const siteStatsLastVisit = document.querySelector('[data-site-stats-last-visit]');
const siteStatsUpdated = document.querySelector('[data-site-stats-updated]');
const siteStatsSummary = document.querySelector('[data-site-stats-summary]');

function renderSiteStats(stats){
  if (!siteStatsCard) return;

  if (!stats || stats.available === false){
    if (siteStatsVisitors) siteStatsVisitors.textContent = '--';
    if (siteStatsVisits) siteStatsVisits.textContent = '--';
    if (siteStatsRatio) siteStatsRatio.textContent = '--';
    if (siteStatsLastVisit) siteStatsLastVisit.textContent = 'Stats unavailable';
    if (siteStatsUpdated) siteStatsUpdated.textContent = 'Stats unavailable';
    if (siteStatsSummary) siteStatsSummary.textContent = 'Site analytics unavailable';
    return;
  }

  if (siteStatsVisitors) siteStatsVisitors.textContent = String(stats.visitors);
  if (siteStatsVisits) siteStatsVisits.textContent = String(stats.visits);
  if (siteStatsRatio) siteStatsRatio.textContent = String(stats.visitsPerVisitor);
  if (siteStatsLastVisit) siteStatsLastVisit.textContent = stats.lastVisit || 'Unknown';
  if (siteStatsUpdated) siteStatsUpdated.textContent = stats.updated || 'Unknown';
  if (siteStatsSummary) siteStatsSummary.textContent = `Site analytics updated: ${stats.visitors} visitors, ${stats.visits} visits, ${stats.visitsPerVisitor} visits per visitor.`;
}

async function loadSiteStats(){
  if (!siteStatsCard) return;

  try{
    const response = await fetch('/api/public-stats.php', {headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error('Stats unavailable');
    renderSiteStats(await response.json());
  }catch(error){
    renderSiteStats({available:false});
  }
}
loadSiteStats();

const modal = document.querySelector('[data-login-modal]');
const openLogin = document.querySelector('[data-login-open]');
const closeLogin = document.querySelector('[data-login-close]');
const loginForm = document.querySelector('[data-login-form]');
const loginError = document.querySelector('[data-login-error]');
let lastFocusedEl = null;

if (loginError) loginError.setAttribute('role', 'alert');

function setLoginExpanded(isExpanded){
  if (openLogin) openLogin.setAttribute('aria-expanded', String(isExpanded));
}

function showLogin(){
  if (!modal) return;
  lastFocusedEl = document.activeElement;
  modal.hidden = false;
  setLoginExpanded(true);
  if (loginError) loginError.hidden = true;
  const firstInput = modal.querySelector('input');
  if (firstInput) firstInput.focus();
}

function hideLogin(){
  if (!modal) return;
  modal.hidden = true;
  setLoginExpanded(false);
  if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
}

function getLoginFocusableEls(){
  if (!modal) return [];
  return [...modal.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && !el.hidden && el.getClientRects().length > 0);
}

function trapLoginFocus(event){
  const focusableEls = getLoginFocusableEls();
  if (!focusableEls.length){
    event.preventDefault();
    return;
  }

  const firstEl = focusableEls[0];
  const lastEl = focusableEls[focusableEls.length - 1];
  if (event.shiftKey && document.activeElement === firstEl){
    event.preventDefault();
    lastEl.focus();
  }else if (!event.shiftKey && document.activeElement === lastEl){
    event.preventDefault();
    firstEl.focus();
  }else if (!modal.contains(document.activeElement)){
    event.preventDefault();
    firstEl.focus();
  }
}

if (openLogin) openLogin.addEventListener('click', showLogin);
if (closeLogin) closeLogin.addEventListener('click', hideLogin);
if (modal) modal.addEventListener('click', event => { if (event.target === modal) hideLogin(); });
document.addEventListener('keydown', event => {
  if (!modal || modal.hidden) return;
  if (event.key === 'Escape') hideLogin();
  if (event.key === 'Tab') trapLoginFocus(event);
});
if (loginForm) loginForm.addEventListener('submit', event => {
  event.preventDefault();
  if (loginError) loginError.hidden = false;
});

const canvas = document.getElementById('grid-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let pointerX = 0;
let pointerY = 0;
let dpr = Math.min(window.devicePixelRatio || 1, 2);
const nodes = [];

function resizeGrid(){
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  seedGrid();
}

function seedGrid(){
  if (!canvas) return;
  nodes.length = 0;
  const cols = 7;
  const rows = 8;
  for (let y = 0; y < rows; y += 1){
    for (let x = 0; x < cols; x += 1){
      nodes.push({
        x: ((x + .5) / cols) * canvas.width,
        y: ((y + .5) / rows) * canvas.height,
        phase: Math.random() * Math.PI * 2
      });
    }
  }
}

function drawGrid(time = 0){
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(37, 99, 235, .10)';
  ctx.lineWidth = 1 * dpr;
  const gap = 44 * dpr;
  for (let x = 0; x < canvas.width; x += gap){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += gap){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

  const driftX = reducedMotion ? 0 : pointerX * 14 * dpr;
  const driftY = reducedMotion ? 0 : pointerY * 10 * dpr;
  for (let i = 0; i < nodes.length; i += 1){
    const node = nodes[i];
    const pulse = reducedMotion ? 0 : Math.sin(time / 900 + node.phase) * 2 * dpr;
    const x = node.x + driftX * (i % 3) / 4;
    const y = node.y + driftY * (i % 4) / 5;
    ctx.fillStyle = 'rgba(15, 118, 110, .55)';
    ctx.beginPath();
    ctx.arc(x, y, 2.2 * dpr + pulse * .2, 0, Math.PI * 2);
    ctx.fill();
    if (i % 5 === 0 && nodes[i + 1]){
      ctx.strokeStyle = 'rgba(15, 118, 110, .16)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nodes[i + 1].x + driftX * .2, nodes[i + 1].y + driftY * .2);
      ctx.stroke();
    }
  }
  if (!reducedMotion) requestAnimationFrame(drawGrid);
}

if (canvas && ctx){
  window.addEventListener('resize', resizeGrid, {passive:true});
  window.addEventListener('pointermove', event => {
    pointerX = (event.clientX / window.innerWidth - .5) * 2;
    pointerY = (event.clientY / window.innerHeight - .5) * 2;
  }, {passive:true});
  resizeGrid();
  drawGrid();
}
