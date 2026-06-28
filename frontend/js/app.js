// Vision Object Detector – Browser (free) + Hugging Face + Azure fallback
// Browser mode works on Vercel without backend, API keys, or Azure credits.

// On Vercel frontend-only deployment, API_URL is null.
// If you later deploy backend, set this before app.js in index.html:
// <script>window.VISION_API_URL = "https://your-backend.onrender.com"</script>
const API_URL = window.VISION_API_URL || (
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : null
);

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
  providerStatus: document.getElementById('provider-status')
};

let currentFile = null;
let currentImageUrl = '';
let currentObjectUrl = '';
let detector = null;
let detectorLoading = null;

function setStatus(message, type = '') {
  els.status.textContent = message || '';
  els.status.className = 'status ' + type;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showResults(objects, provider = '-') {
  els.results.classList.remove('hidden');

  if (!objects || objects.length === 0) {
    els.results.innerHTML = `
      <h3>Results – ${escapeHTML(provider)}</h3>
      <p>No objects found above threshold.</p>
    `;
    return;
  }

  const items = objects.map(objectItem => {
    const label = escapeHTML(objectItem.object || 'object');
    const confidence = Number(objectItem.confidence || 0);

    return `
      <div class="result-item">
        <strong>${label}</strong>
        <span class="conf">${(confidence * 100).toFixed(1)}%</span>
      </div>
    `;
  }).join('');

  els.results.innerHTML = `
    <h3>Detected – ${escapeHTML(provider)} · ${objects.length} objects</h3>
    <div class="result-list">${items}</div>
  `;
}

function drawBoxes(objects) {
  const img = els.previewImg;
  const canvas = els.overlay;

  if (!img || !img.naturalWidth || !img.naturalHeight) {
    return;
  }

  const displayWidth = img.clientWidth;
  const displayHeight = img.clientHeight;
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;

  canvas.width = displayWidth;
  canvas.height = displayHeight;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  if (!objects || objects.length === 0) {
    return;
  }

  const scaleX = displayWidth / naturalWidth;
  const scaleY = displayHeight / naturalHeight;

  ctx.lineWidth = 2;
  ctx.font = '13px Inter, Arial, sans-serif';

  objects.forEach(objectItem => {
    const rectangle = objectItem.rectangle;

    if (!rectangle) {
      return;
    }

    const x = rectangle.x * scaleX;
    const y = rectangle.y * scaleY;
    const width = rectangle.w * scaleX;
    const height = rectangle.h * scaleY;

    ctx.strokeStyle = '#0078d4';
    ctx.strokeRect(x, y, width, height);

    const label = `${objectItem.object || 'object'} ${((objectItem.confidence || 0) * 100).toFixed(0)}%`;
    const textWidth = ctx.measureText(label).width + 8;
    const labelY = Math.max(0, y - 18);

    ctx.fillStyle = '#0078d4';
    ctx.fillRect(x, labelY, textWidth, 18);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 4, labelY + 13);
  });
}

// ---------------- Provider UI ----------------

const hints = {
  browser: 'Runs 100% in your browser. First load downloads ~40MB model, then it is cached. FREE, no API keys.',
  auto: 'Server-side mode. Needs backend with HF_TOKEN or Azure credentials.',
  huggingface: 'Server-side via Hugging Face. Needs backend with HF_TOKEN.',
  azure: 'Azure Computer Vision. Needs backend with AZURE_ENDPOINT and AZURE_KEY.'
};

function updateProviderUI() {
  const selectedProvider = els.provider.value;
  els.providerHint.textContent = hints[selectedProvider] || '';

  const banner = document.getElementById('backend-banner');

  if (banner) {
    if (!API_URL && selectedProvider !== 'browser') {
      banner.className = 'banner warn';
      banner.innerHTML = '⚠️ Server providers need a backend. Using <strong>Browser mode (free)</strong>.';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
}

function refreshProviders() {
  const noBackend = !API_URL;

  Array.from(els.provider.options).forEach(option => {
    if (option.value !== 'browser') {
      option.disabled = noBackend;

      if (!option.dataset.originalText) {
        option.dataset.originalText = option.textContent.replace(' (needs backend)', '');
      }

      option.textContent = option.dataset.originalText + (noBackend ? ' (needs backend)' : '');
    }
  });

  if (noBackend) {
    els.provider.value = 'browser';
  }
}

els.provider.value = 'browser';

els.provider.addEventListener('change', () => {
  if (!API_URL && els.provider.value !== 'browser') {
    els.provider.value = 'browser';
    setStatus('Server providers need a backend. Using Browser mode.', 'error');
  }

  updateProviderUI();
});

refreshProviders();
updateProviderUI();

// Provider status pills
async function loadProviderStatus() {
  if (!API_URL) {
    els.providerStatus.innerHTML = `
      <span class="pill ok">Browser – FREE ✓</span>
      <span class="pill warn">Server providers need backend</span>
    `;
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/health`);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      throw new Error('Backend did not return JSON');
    }

    const data = await response.json();

    els.providerStatus.innerHTML = [
      '<span class="pill ok">Browser – FREE ✓</span>',
      `<span class="pill ${data.providers && data.providers.huggingface ? 'ok' : 'warn'}">HF – ${data.providers && data.providers.huggingface ? 'ready' : 'no token'}</span>`,
      `<span class="pill ${data.providers && data.providers.azure ? 'ok' : 'warn'}">Azure – ${data.providers && data.providers.azure ? 'ready' : 'no key'}</span>`
    ].join('');
  } catch (error) {
    els.providerStatus.innerHTML = `
      <span class="pill ok">Browser – FREE ✓</span>
      <span class="pill warn">Backend offline</span>
    `;
  }
}

loadProviderStatus();

// ---------------- Image Loading ----------------

function setImageFromFile(file) {
  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    setStatus('Not an image. Please upload JPG, PNG, or WebP.', 'error');
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    setStatus('File is larger than 8 MB. Please choose a smaller image.', 'error');
    return;
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = '';
  }

  currentFile = file;
  currentImageUrl = '';
  currentObjectUrl = URL.createObjectURL(file);

  els.previewImg.removeAttribute('crossorigin');

  els.previewImg.onload = () => {
    drawBoxes([]);
  };

  els.previewImg.onerror = () => {
    setStatus('Could not load uploaded image. Try another JPG/PNG/WebP file.', 'error');
  };

  els.previewImg.src = currentObjectUrl;
  els.previewWrap.classList.remove('hidden');
  els.results.classList.add('hidden');
  els.results.innerHTML = '';

  setStatus('Image loaded. Click Detect Objects.');
}

function setImageFromUrl(url) {
  if (!url) {
    setStatus('Enter an image URL first.', 'error');
    return;
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = '';
  }

  currentFile = null;
  currentImageUrl = url;

  els.previewImg.crossOrigin = 'anonymous';

  els.previewImg.onload = () => {
    drawBoxes([]);
  };

  els.previewImg.onerror = () => {
    setStatus('Failed to load image URL. Use Upload tab instead. Some websites block image access through CORS.', 'error');
  };

  els.previewImg.src = url;
  els.previewWrap.classList.remove('hidden');
  els.results.classList.add('hidden');
  els.results.innerHTML = '';

  setStatus('Image loaded. Click Detect Objects.');
}

// Dropzone
els.dropzone.addEventListener('click', () => {
  els.fileInput.click();
});

els.dropzone.addEventListener('dragover', event => {
  event.preventDefault();
  els.dropzone.classList.add('drag');
});

els.dropzone.addEventListener('dragleave', () => {
  els.dropzone.classList.remove('drag');
});

els.dropzone.addEventListener('drop', event => {
  event.preventDefault();
  els.dropzone.classList.remove('drag');

  const file = event.dataTransfer.files[0];

  if (file) {
    setImageFromFile(file);
  }
});

els.fileInput.addEventListener('change', event => {
  const file = event.target.files[0];

  if (file) {
    setImageFromFile(file);
  }
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => {
      item.classList.remove('active');
    });

    document.querySelectorAll('.tab-pane').forEach(item => {
      item.classList.remove('active');
    });

    tab.classList.add('active');

    const pane = document.getElementById('pane-' + tab.dataset.tab);

    if (pane) {
      pane.classList.add('active');
    }
  });
});

// URL load
els.loadUrlBtn.addEventListener('click', () => {
  const url = els.imageUrl.value.trim();

  if (!url) {
    setStatus('Enter an image URL.', 'error');
    return;
  }

  setImageFromUrl(url);
});

// Samples
const samples = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  'https://images.unsplash.com/photo-1511910849309-0dffb8785146?w=800',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800'
];

document.getElementById('sample-grid').innerHTML = samples.map(sampleUrl => {
  return `<img src="${sampleUrl}" loading="lazy" alt="sample" crossorigin="anonymous">`;
}).join('');

document.getElementById('sample-grid').addEventListener('click', event => {
  if (event.target.tagName === 'IMG') {
    setImageFromUrl(event.target.src.replace('w=800', 'w=1200'));
  }
});

// Threshold
els.threshold.addEventListener('input', () => {
  els.thresholdVal.textContent = parseFloat(els.threshold.value).toFixed(2);
});

// ---------------- Browser Detector ----------------

async function getBrowserDetector() {
  if (detector) return detector;
  if (detectorLoading) return detectorLoading;

  setStatus('Loading AI model in browser (~40 MB, one-time)…', '');

  detectorLoading = (async () => {
    const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    const { pipeline, env } = transformers;

    // Important for Vercel/static deployments:
    // Do NOT try to load model files from /models/... on our own website.
    // If allowed, Vercel may return HTML 404 pages, causing:
    // "Unexpected token '<', '<!DOCTYPE ...' is not valid JSON"
    env.allowLocalModels = false;

    // Cache model files in browser after first download.
    env.useBrowserCache = true;

    // Make sure ONNX WASM files are loaded from CDN, not from our Vercel site.
    if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
      env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';
    }

    const modelsToTry = [
      'Xenova/detr-resnet-50',
      'Xenova/yolos-tiny'
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        setStatus(`Loading browser AI model: ${modelName}…`, '');

        const loadedDetector = await pipeline('object-detection', modelName, {
          progress_callback: progress => {
            if (progress.status === 'downloading' || progress.status === 'progress') {
              const percent = progress.progress ? Math.round(progress.progress) : 0;
              setStatus(`Downloading model… ${percent}%`, '');
            }
          }
        });

        detector = loadedDetector;
        detectorLoading = null;

        setStatus(`AI model loaded: ${modelName}`, 'ok');

        return loadedDetector;
      } catch (error) {
        lastError = error;
        console.warn(`Failed to load ${modelName}:`, error);
      }
    }

    throw lastError || new Error('No browser AI model could be loaded.');
  })().catch(error => {
    detectorLoading = null;

    const detail = error && error.message ? error.message : String(error);

    throw new Error(
      `Browser AI model failed to load. This is usually a model/CDN loading issue, not an upload issue. Details: ${detail}`
    );
  });

  return detectorLoading;
}

async function detectBrowser(imageElement, threshold) {
  const browserDetector = await getBrowserDetector();

  setStatus('Running detection in browser…', '');

  const output = await browserDetector(imageElement.src, {
    threshold,
    percentage: true
  });

  return output.map(item => ({
    object: item.label,
    confidence: item.score,
    rectangle: {
      x: Math.round(item.box.xmin),
      y: Math.round(item.box.ymin),
      w: Math.round(item.box.xmax - item.box.xmin),
      h: Math.round(item.box.ymax - item.box.ymin)
    }
  }));
}

// ---------------- Detect Button ----------------

els.detectBtn.addEventListener('click', async () => {
  let provider = els.provider.value;
  const threshold = parseFloat(els.threshold.value);

  if (!els.previewImg.src || !els.previewImg.complete || !els.previewImg.naturalWidth) {
    setStatus('Load an image first.', 'error');
    return;
  }

  if (provider !== 'browser' && !API_URL) {
    provider = 'browser';
    els.provider.value = 'browser';
    updateProviderUI();
  }

  els.detectBtn.disabled = true;
  els.detectBtn.textContent = 'Detecting…';
  setStatus('');

  try {
    let objects = [];
    let usedProvider = provider;

    if (provider === 'browser') {
      objects = await detectBrowser(els.previewImg, threshold);
      usedProvider = 'browser (Transformers.js)';
    } else {
      if (!API_URL) {
        throw new Error('Backend is not configured on this deployment. Please use Browser provider.');
      }

      let body;
      const headers = {};

      if (currentFile) {
        body = new FormData();
        body.append('image', currentFile);
        body.append('provider', provider);
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          imageUrl: currentImageUrl || els.previewImg.src,
          provider
        });
      }

      const response = await fetch(`${API_URL}/api/vision/detect`, {
        method: 'POST',
        headers,
        body
      });

      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        throw new Error('Backend returned HTML instead of JSON. Use Browser provider or configure a backend API URL.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Detection failed');
      }

      objects = data.objects || [];
      usedProvider = data.provider || provider;

      if (data.model) {
        usedProvider += ` / ${data.model}`;
      }
    }

    objects = objects
      .filter(item => item.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence);

    drawBoxes(objects);
    showResults(objects, usedProvider);
    setStatus(`Found ${objects.length} objects – ${usedProvider}`, 'ok');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Detection failed.', 'error');
    els.results.classList.add('hidden');
    drawBoxes([]);
  } finally {
    els.detectBtn.disabled = false;
    els.detectBtn.textContent = 'Detect Objects';
  }
});

// Clear
els.clearBtn.addEventListener('click', () => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = '';
  }

  currentFile = null;
  currentImageUrl = '';

  els.previewImg.removeAttribute('src');
  els.previewWrap.classList.add('hidden');
  els.results.classList.add('hidden');
  els.results.innerHTML = '';

  drawBoxes([]);
  setStatus('');

  els.fileInput.value = '';
  els.imageUrl.value = '';
});

// Simple safe behavior: clear overlay on resize.
// User can click Detect again if needed.
window.addEventListener('resize', () => {
  drawBoxes([]);
});