// Vision Object Detector – 3 providers: browser (Transformers.js), huggingface, azure
// Browser mode = 100% free, no credits, runs locally

let API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : window.location.origin;

// Allow override via window.VISION_API_URL (set in index.html for Vercel)
// or via import from ./config.js if using a bundler
try {
  const cfg = await import('./config.js').catch(()=>null);
  if (cfg && cfg.API_URL) API_URL = cfg.API_URL;
} catch {}
if (window.VISION_API_URL) API_URL = window.VISION_API_URL;

const els = {
  provider: document.getElementById('provider'),
  providerHint: document.getElementById('provider-hint'),
  threshold: document.getElementById('threshold'),
  thresholdVal: document.getElementById('threshold-val'),
  fileInput: document.getElementById('file-input'),
  dropzone: document.getElementById('dropzone'),
  imageUrl: document.getElementById('image-url'),
  loadUrlBtn: document.getElementById('load-url-btn'),
  previewWrap: document.getElementById('preview-wrap'),
  previewImg: document.getElementById('preview-img'),
  overlay: document.getElementById('overlay'),
  detectBtn: document.getElementById('detect-button'),
  clearBtn: document.getElementById('clear-button'),
  results: document.getElementById('results'),
  status: document.getElementById('status'),
  providerStatus: document.getElementById('provider-status'),
};

let currentFile = null;
let currentImageUrl = '';
let detector = null; // transformers.js pipeline
let detectorLoading = null;

// --- UI helpers
function setStatus(msg, type='') {
  els.status.textContent = msg || '';
  els.status.className = 'status ' + type;
}
function showResults(objects, provider='-') {
  els.results.classList.remove('hidden');
  if (!objects || objects.length === 0) {
    els.results.innerHTML = `<h3>Results – ${provider}</h3><p>No objects found above threshold.</p>`;
    return;
  }
  const items = objects.map(o =>
    `<div class="result-item"><strong>${o.object}</strong><span class="conf">${(o.confidence*100).toFixed(1)}%</span></div>`
  ).join('');
  els.results.innerHTML = `<h3>Detected – ${provider} · ${objects.length} objects</h3><div class="result-list">${items}</div>`;
}
function drawBoxes(objects) {
  const img = els.previewImg;
  const canvas = els.overlay;
  const w = img.clientWidth, h = img.clientHeight;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  canvas.width = w; canvas.height = h;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  if (!objects) return;
  const sx = w / nw, sy = h / nh;
  ctx.lineWidth = 2;
  ctx.font = '13px Inter, sans-serif';
  objects.forEach(o => {
    const r = o.rectangle;
    if (!r) return;
    const x = r.x * sx, y = r.y * sy, rw = r.w * sx, rh = r.h * sy;
    ctx.strokeStyle = '#0078d4';
    ctx.strokeRect(x, y, rw, rh);
    const label = `${o.object} ${(o.confidence*100).toFixed(0)}%`;
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = '#0078d4';
    ctx.fillRect(x, Math.max(0, y-18), tw, 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x+4, Math.max(12, y-5));
  });
}

// --- provider status pills
async function loadProviderStatus() {
  try {
    const r = await fetch(`${API_URL}/api/health`);
    const j = await r.json();
    const pills = [
      `<span class="pill ok">Browser – FREE ✓</span>`,
      `<span class="pill ${j.providers.huggingface ? 'ok':'warn'}">Hugging Face – ${j.providers.huggingface ? 'ready' : 'needs HF_TOKEN'}</span>`,
      `<span class="pill ${j.providers.azure ? 'ok':'warn'}">Azure – ${j.providers.azure ? 'ready' : 'no credits? use Browser'}</span>`
    ];
    els.providerStatus.innerHTML = pills.join('');
  } catch {
    els.providerStatus.innerHTML = `<span class="pill ok">Browser – FREE ✓</span><span class="pill warn">Backend offline – Browser mode still works</span>`;
  }
}
loadProviderStatus();

// --- file handling
function setImageFromFile(file) {
  if (!file.type.startsWith('image/')) { setStatus('Not an image', 'error'); return; }
  if (file.size > 8 * 1024 * 1024) { setStatus('File > 8 MB', 'error'); return; }
  currentFile = file;
  currentImageUrl = '';
  const url = URL.createObjectURL(file);
  els.previewImg.onload = () => { drawBoxes([]); URL.revokeObjectURL(url); };
  els.previewImg.src = url;
  els.previewWrap.classList.remove('hidden');
  els.results.classList.add('hidden');
  setStatus('');
}
function setImageFromUrl(url) {
  currentFile = null;
  currentImageUrl = url;
  els.previewImg.onload = () => drawBoxes([]);
  els.previewImg.onerror = () => setStatus('Failed to load image URL – try uploading instead, or check CORS.', 'error');
  els.previewImg.crossOrigin = 'anonymous';
  els.previewImg.src = url;
  els.previewWrap.classList.remove('hidden');
  els.results.classList.add('hidden');
  setStatus('');
}

// dropzone
els.dropzone.addEventListener('click', () => els.fileInput.click());
els.dropzone.addEventListener('dragover', e => { e.preventDefault(); els.dropzone.classList.add('drag'); });
els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('drag'));
els.dropzone.addEventListener('drop', e => {
  e.preventDefault(); els.dropzone.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f) setImageFromFile(f);
});
els.fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) setImageFromFile(f);
});

// tabs
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('pane-' + t.dataset.tab).classList.add('active');
  });
});

// URL load
els.loadUrlBtn.addEventListener('click', () => {
  const url = els.imageUrl.value.trim();
  if (!url) return setStatus('Enter an image URL', 'error');
  setImageFromUrl(url);
});

// samples
const samples = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  'https://images.unsplash.com/photo-1511910849309-0dffb8785146?w=800',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800',
];
document.getElementById('sample-grid').innerHTML = samples.map(s =>
  `<img src="${s}" loading="lazy" alt="sample">`
).join('');
document.getElementById('sample-grid').addEventListener('click', e => {
  if (e.target.tagName === 'IMG') { setImageFromUrl(e.target.src.replace('w=800','w=1200')); }
});

// threshold
els.threshold.addEventListener('input', () => {
  els.thresholdVal.textContent = parseFloat(els.threshold.value).toFixed(2);
});

// provider hint
const hints = {
  browser: 'Runs 100% in your browser with Transformers.js. First load downloads ~40MB model, then instant. 100% FREE, no API keys.',
  auto: 'Tries Hugging Face first, falls back to Azure. Needs HF_TOKEN in backend .env for free server-side detection.',
  huggingface: 'Server-side via Hugging Face Inference API. Set HF_TOKEN in backend/.env – free token at huggingface.co/settings/tokens',
  azure: 'Microsoft Azure Computer Vision. Needs AZURE_ENDPOINT + AZURE_KEY – credits required.'
};
function updateProviderHint() {
  els.providerHint.textContent = hints[els.provider.value] || '';
}
els.provider.addEventListener('change', updateProviderHint);
updateProviderHint();

// --- Browser-local detector (Transformers.js)
async function getBrowserDetector() {
  if (detector) return detector;
  if (detectorLoading) return detectorLoading;
  setStatus('Loading AI model in browser (~40 MB, one-time)…', '');
  detectorLoading = (async () => {
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    const det = await pipeline('object-detection', 'Xenova/detr-resnet-50', {
      progress_callback: p => {
        if (p.status === 'downloading') setStatus(`Downloading model… ${p.file} ${Math.round(p.progress||0)}%`, '');
      }
    });
    detector = det;
    detectorLoading = null;
    return det;
  })();
  return detectorLoading;
}

async function detectBrowser(imageEl, threshold) {
  const det = await getBrowserDetector();
  setStatus('Running detection in browser…', '');
  const output = await det(imageEl.src, { threshold, percentage: true });
  // output: [{score, label, box:{xmin,ymin,xmax,ymax}}]
  const nw = imageEl.naturalWidth, nh = imageEl.naturalHeight;
  return output.map(o => ({
    object: o.label,
    confidence: o.score,
    rectangle: {
      x: Math.round(o.box.xmin),
      y: Math.round(o.box.ymin),
      w: Math.round(o.box.xmax - o.box.xmin),
      h: Math.round(o.box.ymax - o.box.ymin)
    }
  }));
}

// --- detect button
els.detectBtn.addEventListener('click', async () => {
  const provider = els.provider.value;
  const threshold = parseFloat(els.threshold.value);

  if (!els.previewImg.src || !els.previewImg.complete) {
    return setStatus('Load an image first', 'error');
  }

  els.detectBtn.disabled = true;
  els.detectBtn.textContent = 'Detecting…';
  setStatus('');

  try {
    let objects = [], usedProvider = provider;

    if (provider === 'browser') {
      objects = await detectBrowser(els.previewImg, threshold);
      usedProvider = 'browser (Transformers.js)';
    } else {
      // server-side
      let body, headers = {};
      if (currentFile) {
        body = new FormData();
        body.append('image', currentFile);
        body.append('provider', provider);
        // fetch will set Content-Type
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ imageUrl: currentImageUrl || els.previewImg.src, provider });
      }
      const res = await fetch(`${API_URL}/api/vision/detect`, {
        method: 'POST',
        headers,
        body: currentFile ? body : body
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Detection failed');
      objects = data.objects || [];
      usedProvider = data.provider || provider;
      if (data.model) usedProvider += ` / ${data.model}`;
    }

    // filter by threshold (server may return all)
    objects = objects.filter(o => o.confidence >= threshold);
    objects.sort((a,b)=> b.confidence - a.confidence);

    drawBoxes(objects);
    showResults(objects, usedProvider);
    setStatus(`Found ${objects.length} objects – ${usedProvider}`, 'ok');

  } catch (err) {
    console.error(err);
    setStatus(err.message, 'error');
    els.results.classList.add('hidden');
    drawBoxes([]);
  } finally {
    els.detectBtn.disabled = false;
    els.detectBtn.textContent = 'Detect Objects';
  }
});

// clear
els.clearBtn.addEventListener('click', () => {
  currentFile = null; currentImageUrl = '';
  els.previewImg.src = '';
  els.previewWrap.classList.add('hidden');
  els.results.classList.add('hidden');
  els.results.innerHTML = '';
  drawBoxes([]);
  setStatus('');
  els.fileInput.value = '';
  els.imageUrl.value = '';
});

// redraw boxes on resize
window.addEventListener('resize', () => {
  const canvas = els.overlay;
  if (canvas.width > 0) {
    // re-draw last results – simple: just clear, user can re-detect
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }
});
