const $ = (id) => document.getElementById(id);

const STORAGE = 'sloth-minute-postcards:v1';

function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function pad2(n){ return String(n).padStart(2,'0'); }

function defaultState(){
  return {
    pack: 'soft-boundaries',
    prompt: null,
    text: '',
    style: 'forest',
    stamp: 'none',
    timer: 0,
    saved: [], // {id, pack, prompt, text, style, stamp, createdAt}
  };
}

function load(){
  try{
    const raw = localStorage.getItem(STORAGE);
    if(!raw) return defaultState();
    const j = JSON.parse(raw);
    return { ...defaultState(), ...j, saved: Array.isArray(j.saved)?j.saved:[] };
  } catch { return defaultState(); }
}

let state = load();
function save(){ localStorage.setItem(STORAGE, JSON.stringify(state)); }

function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }

function packById(id){ return window.SLOTH_PACKS.find(p => p.id === id) || window.SLOTH_PACKS[0]; }

function pickPrompt(){
  const p = packById(state.pack);
  const list = p.prompts;
  const idx = Math.floor(Math.random()*list.length);
  state.prompt = list[idx];
  save();
}

function applyHash(){
  const h = (location.hash||'').replace(/^#/, '');
  if(!h) return;
  const params = new URLSearchParams(h);
  const pack = params.get('pack');
  const style = params.get('style');
  const stamp = params.get('stamp');
  const prompt = params.get('prompt');
  const text = params.get('text');

  if(pack) state.pack = pack;
  if(style) state.style = style;
  if(stamp) state.stamp = stamp;
  if(prompt) state.prompt = decodeURIComponent(prompt);
  if(text) state.text = decodeURIComponent(text);
  save();
}

function buildHash(){
  const params = new URLSearchParams();
  params.set('pack', state.pack);
  params.set('style', state.style);
  params.set('stamp', state.stamp);
  params.set('prompt', encodeURIComponent(state.prompt || ''));
  params.set('text', encodeURIComponent(state.text || ''));
  return `#${params.toString()}`;
}

applyHash();

// Timer
let t = { endsAt: null, tick: null };
function setTimer(sec){
  state.timer = sec;
  save();
  if(t.tick) clearInterval(t.tick);
  t.endsAt = null;
  $('timeLeft').textContent = sec ? fmt(sec) : '—';
  if(!sec) return;
  t.endsAt = Date.now() + sec*1000;
  t.tick = setInterval(() => {
    const left = Math.max(0, Math.ceil((t.endsAt - Date.now())/1000));
    $('timeLeft').textContent = fmt(left);
    if(left <= 0){
      clearInterval(t.tick);
      t.tick = null;
      $('timeLeft').textContent = 'done';
    }
  }, 200);
}

function fmt(sec){
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${pad2(m)}:${pad2(s)}`;
}

// Canvas rendering
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

function theme(style){
  if(style === 'cream') return {
    bg: ['#f6f1e6', '#f1e8d6'],
    ink: '#1c1c1c',
    muted: 'rgba(28,28,28,0.72)',
    accent: '#0f6b47',
    accent2: '#1b4bd6',
    paper: true
  };
  if(style === 'ocean') return {
    bg: ['#061821', '#0b2a3a'],
    ink: '#eef7ff',
    muted: 'rgba(238,247,255,0.72)',
    accent: '#7bd389',
    accent2: '#6aa7ff',
    paper: false
  };
  if(style === 'mono') return {
    bg: ['#0b0f14', '#0b0f14'],
    ink: '#f2f7ff',
    muted: 'rgba(242,247,255,0.66)',
    accent: '#f2f7ff',
    accent2: '#f2f7ff',
    paper: false
  };
  return {
    bg: ['#070a0f', '#0b0f14'],
    ink: '#f2f7ff',
    muted: 'rgba(242,247,255,0.72)',
    accent: '#7bd389',
    accent2: '#6aa7ff',
    paper: false
  };
}

function draw(){
  const th = theme(state.style);
  const w = canvas.width, h = canvas.height;

  // bg
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, th.bg[0]);
  g.addColorStop(1, th.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // subtle texture
  if(th.paper){
    ctx.globalAlpha = 0.08;
    for(let i=0;i<1200;i++){
      const x = Math.random()*w;
      const y = Math.random()*h;
      const r = Math.random()*1.2;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 0.14;
    for(let i=0;i<140;i++){
      const x = Math.random()*w;
      const y = Math.random()*h;
      const r = Math.random()*1.8;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // card
  ctx.fillStyle = th.paper ? 'rgba(255,255,255,0.65)' : 'rgba(17,25,38,0.88)';
  roundRect(70,70,w-140,h-140, 28);
  ctx.fill();
  ctx.strokeStyle = th.paper ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // header
  ctx.fillStyle = th.ink;
  ctx.font = th.paper ? '900 58px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' : '900 62px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText('Sloth Minute Postcards', 120, 158);

  // prompt
  ctx.fillStyle = th.muted;
  ctx.font = '650 26px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  ctx.fillText('PROMPT', 120, 214);
  ctx.fillStyle = th.ink;
  ctx.font = '800 34px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  wrapText(state.prompt || '—', 120, 266, w-240, 42, 2);

  // body
  ctx.fillStyle = th.muted;
  ctx.font = '650 26px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  ctx.fillText('ONE PARAGRAPH', 120, 352);
  ctx.fillStyle = th.ink;
  ctx.font = '500 30px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  wrapText(state.text || '…', 120, 404, w-240, 40, 6);

  // stamp
  if(state.stamp && state.stamp !== 'none'){
    const stampText = state.stamp.toUpperCase();
    ctx.save();
    ctx.translate(w-260, 190);
    ctx.rotate(-0.12);
    ctx.strokeStyle = th.paper ? 'rgba(15,107,71,0.55)' : 'rgba(123,211,137,0.55)';
    ctx.lineWidth = 4;
    ctx.fillStyle = th.paper ? 'rgba(15,107,71,0.12)' : 'rgba(123,211,137,0.10)';
    roundRect(-160, -44, 320, 88, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = th.paper ? 'rgba(15,107,71,0.75)' : 'rgba(123,211,137,0.75)';
    ctx.font = '900 26px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(stampText, 0, 10);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  // footer
  ctx.fillStyle = th.paper ? 'rgba(28,28,28,0.70)' : 'rgba(242,247,255,0.70)';
  ctx.font = '600 24px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText('owleggsbot.github.io/sloth-minute-postcards', 120, h-120);

  // sloth mark
  ctx.save();
  ctx.translate(w-210, 110);
  ctx.scale(2.4, 2.4);
  drawSlothMark(th.paper);
  ctx.restore();

  function roundRect(x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  function wrapText(text, x, y, maxWidth, lineHeight, maxLines){
    const words = String(text).split(/\s+/).filter(Boolean);
    let line = '';
    let lines = 0;
    for(const w of words){
      const test = line ? (line + ' ' + w) : w;
      if(ctx.measureText(test).width > maxWidth){
        ctx.fillText(line, x, y);
        line = w;
        y += lineHeight;
        lines++;
        if(lines >= maxLines-1) break;
      } else {
        line = test;
      }
    }
    if(line && lines < maxLines) ctx.fillText(line, x, y);
  }

  function drawSlothMark(paper){
    ctx.fillStyle = paper ? 'rgba(15,107,71,0.75)' : 'rgba(123,211,137,0.95)';
    ctx.beginPath();
    ctx.ellipse(30, 30, 24, 22, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = paper ? 'rgba(28,28,28,0.9)' : 'rgba(11,15,20,0.9)';
    ctx.beginPath();
    ctx.ellipse(22, 28, 6, 7, 0, 0, Math.PI*2);
    ctx.ellipse(38, 28, 6, 7, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.strokeStyle = paper ? 'rgba(28,28,28,0.9)' : 'rgba(11,15,20,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(30, 36, 9, 0.1*Math.PI, 0.9*Math.PI);
    ctx.stroke();
  }
}

async function toBlob(){
  return await new Promise(res => $('canvas').toBlob(res, 'image/png'));
}

async function copyImage(){
  const blob = await toBlob();
  try{
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    $('btnCopy').textContent = 'Copied';
    setTimeout(()=> $('btnCopy').textContent = 'Copy image', 1200);
  } catch {
    $('btnCopy').textContent = 'Unsupported';
    setTimeout(()=> $('btnCopy').textContent = 'Copy image', 1400);
  }
}

async function downloadImage(){
  const blob = await toBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sloth-postcard-${Date.now()}.png`;
  a.click();
}

async function copyLink(){
  // update hash
  location.hash = buildHash();
  const link = `${location.origin}${location.pathname}${location.hash}`;
  try{
    await navigator.clipboard.writeText(link);
    $('btnCopyLink').textContent = 'Copied';
    setTimeout(()=> $('btnCopyLink').textContent = 'Copy link', 1200);
  } catch {
    $('btnCopyLink').textContent = 'Select + copy';
    setTimeout(()=> $('btnCopyLink').textContent = 'Copy link', 1400);
  }
}

function renderSaved(){
  $('savedCount').textContent = String(state.saved.length);
  const host = $('saved');
  host.innerHTML = '';
  if(state.saved.length === 0){
    host.innerHTML = `<div class="small muted">No saved postcards yet.</div>`;
    return;
  }

  const items = state.saved.slice().reverse().slice(0,12);
  for(const s of items){
    const el = document.createElement('div');
    el.className = 'sCard';
    el.innerHTML = `<div class="sTitle">${escapeHtml(s.prompt).slice(0,80)}${s.prompt.length>80?'…':''}</div><div class="sMeta">${new Date(s.createdAt).toLocaleString()} • ${escapeHtml(s.style)}</div>`;
    el.addEventListener('click', () => {
      state.pack = s.pack;
      state.prompt = s.prompt;
      state.text = s.text;
      state.style = s.style;
      state.stamp = s.stamp;
      save();
      hydrate();
    });
    host.appendChild(el);
  }
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function exportJson(){
  const blob = new Blob([JSON.stringify({ version:1, saved: state.saved }, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sloth-postcards-${Date.now()}.json`;
  a.click();
}

function clearSaved(){
  if(!confirm('Clear saved postcards on this device?')) return;
  state.saved = [];
  save();
  renderSaved();
}

function hydrate(){
  // pack select
  $('pack').innerHTML = '';
  for(const p of window.SLOTH_PACKS){
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    if(p.id === state.pack) o.selected = true;
    $('pack').appendChild(o);
  }

  $('style').value = state.style;
  $('stamp').value = state.stamp;
  $('timer').value = String(state.timer);
  $('text').value = state.text;
  $('prompt').textContent = state.prompt || '—';

  renderSaved();
  draw();
}

// wiring
$('pack').addEventListener('change', () => {
  state.pack = $('pack').value;
  state.prompt = null;
  save();
  pickPrompt();
  hydrate();
});
$('style').addEventListener('change', () => { state.style = $('style').value; save(); draw(); });
$('stamp').addEventListener('change', () => { state.stamp = $('stamp').value; save(); draw(); });
$('timer').addEventListener('change', () => { setTimer(clamp(parseInt($('timer').value,10),0,600)); });
$('text').addEventListener('input', () => { state.text = $('text').value; save(); draw(); });

$('btnNew').addEventListener('click', () => {
  state.text = '';
  pickPrompt();
  save();
  hydrate();
});
$('btnShuffle').addEventListener('click', () => { pickPrompt(); hydrate(); });
$('btnStart').addEventListener('click', () => setTimer(clamp(parseInt($('timer').value,10),0,600) || 60));

$('btnSave').addEventListener('click', () => {
  if(!state.prompt) return;
  const entry = {
    id: uid(),
    pack: state.pack,
    prompt: state.prompt,
    text: state.text,
    style: state.style,
    stamp: state.stamp,
    createdAt: new Date().toISOString(),
  };
  state.saved.push(entry);
  // keep bounded
  state.saved = state.saved.slice(-200);
  save();
  renderSaved();
});

$('btnCopy').addEventListener('click', copyImage);
$('btnDownload').addEventListener('click', downloadImage);
$('btnPrint').addEventListener('click', () => window.print());
$('btnCopyLink').addEventListener('click', copyLink);
$('btnExportJson').addEventListener('click', exportJson);
$('btnClear').addEventListener('click', clearSaved);

// initial
if(!state.prompt) pickPrompt();
hydrate();
$('timeLeft').textContent = state.timer ? fmt(state.timer) : '—';

// reduced motion
if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  // no special animation here; fine
}
