// Year stamp
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Prefers reduced motion
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Glass nav scroll state + ScrollSpy
const nav = document.getElementById('nav');
const links = nav ? [...nav.querySelectorAll('a[href^="#"]')] : [];
const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

function onScroll(){
  const y = window.scrollY || document.documentElement.scrollTop;
  if (nav) nav.classList.toggle('scrolled', y > 10);
}
window.addEventListener('scroll', onScroll, {passive:true});
onScroll();

// ScrollSpy
if (sections.length){
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const id = '#' + e.target.id;
      const active = nav && nav.querySelector(`a[href="${id}"]`);
      if (!active) return;
      if (e.isIntersecting) links.forEach(l => l.classList.toggle('active', l === active));
    })
  }, {rootMargin: '-55% 0px -40% 0px', threshold: 0});
  sections.forEach(s => spy.observe(s));
}

// Smooth anchor offset for fixed header
links.forEach(a => a.addEventListener('click', e => {
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('#')) return;
  const target = document.querySelector(href);
  if (!target) return;
  e.preventDefault();
  const headerH = nav ? nav.getBoundingClientRect().height + 12 : 0;
  const top = target.getBoundingClientRect().top + window.pageYOffset - headerH;
  window.scrollTo({top, behavior:'smooth'});
  history.pushState(null, '', href);
}));

// Parallax (cursor-based) & Atmosphere (fog + glints)
const headline = document.getElementById('headline');
const backdrop = document.getElementById('backdrop');
const atmo = document.getElementById('atmo');
const ctx = atmo ? atmo.getContext('2d') : null;

let px = 0, py = 0; // normalized -1..1
if (!REDUCED){
  window.addEventListener('pointermove', (e) => {
    const w = window.innerWidth, h = window.innerHeight;
    px = (e.clientX - w/2) / (w/2);
    py = (e.clientY - h/2) / (h/2);
  }, {passive:true});
}

// Canvas sizing
let dpr = Math.min(2, window.devicePixelRatio || 1);
function resizeCanvas(){
  if (!atmo) return;
  const w = atmo.clientWidth, h = atmo.clientHeight;
  atmo.width = Math.round(w * dpr);
  atmo.height = Math.round(h * dpr);
}
if (atmo){
  new ResizeObserver(resizeCanvas).observe(atmo);
  resizeCanvas();
}

// Particles
const fog = []; const glints = [];
const PARTICLES = 26;
function seed(){
  if (!atmo) return;
  fog.length = 0; glints.length = 0;
  const W = atmo.width, H = atmo.height;
  for(let i=0;i<PARTICLES;i++)
    fog.push({x:Math.random()*W, y:Math.random()*H, r:(40+Math.random()*120)*dpr, a:0.04+Math.random()*0.06, vx:(0.03+Math.random()*0.08)*dpr});
  for(let i=0;i<8;i++)
    glints.push({x:Math.random()*W, y:Math.random()*H, r:(1+Math.random()*2)*dpr, a:0.03+Math.random()*0.06, vy:(0.06+Math.random()*0.12)*dpr});
}
seed();

let running = true;
document.addEventListener('visibilitychange', ()=>{running = !document.hidden});

function frame(){
  if (!ctx || !atmo){ requestAnimationFrame(frame); return; }
  if (!running){ requestAnimationFrame(frame); return; }
  const W = atmo.width, H = atmo.height;

  // Parallax offsets
  const depth = REDUCED ? 0 : 10; // px max (far layer)
  const offX = px * depth * dpr;
  const offY = py * depth * dpr;

  ctx.clearRect(0,0,W,H);

  // Fog
  for(const p of fog){
    p.x += p.vx; if(p.x - p.r > W) p.x = -p.r;
    ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,${p.a})`;
    ctx.arc(p.x + offX*0.5, p.y + offY*0.5, p.r, 0, Math.PI*2);
    ctx.fill();
  }

  // Glints
  for(const g of glints){
    g.y -= g.vy; if(g.y + g.r < 0){ g.y = H + g.r; g.x = Math.random()*W; }
    ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,${g.a})`;
    ctx.arc(g.x + offX*0.8, g.y + offY*0.8, g.r, 0, Math.PI*2);
    ctx.fill();
  }

  // Headline + Backdrop transforms
  if (!REDUCED){
    if (headline) headline.style.transform = `translate3d(${(px*8).toFixed(2)}px, ${(py*6).toFixed(2)}px, 0)`;
    if (backdrop) backdrop.style.transform = `translate3d(${(-px*4).toFixed(2)}px, ${(-py*3).toFixed(2)}px, 0)`;
  }

  requestAnimationFrame(frame);
}
if (!REDUCED) requestAnimationFrame(frame);

// High-DPI swap listener
if (window.matchMedia && window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener){
  window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', ()=>{
    dpr = Math.min(2, window.devicePixelRatio || 1); resizeCanvas(); seed();
  });
}
