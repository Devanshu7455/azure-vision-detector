require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();

// ---- middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Rate limit: 60 req / min per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' }
}));

// uploads folder for debugging (optional)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Multer – memory storage, 8 MB max
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  }
});

// ---- providers
async function detectWithHuggingFace(imageBuffer, imageUrl) {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error('HF_TOKEN not configured');
  
  const model = process.env.HF_MODEL || 'facebook/detr-resnet-50';
  const url = `https://api-inference.huggingface.co/models/${model}`;

  let data, headers = { Authorization: `Bearer ${token}` };

  if (imageBuffer) {
    headers['Content-Type'] = 'application/octet-stream';
    data = imageBuffer;
  } else if (imageUrl) {
    // HF Inference API doesn't accept URLs directly for DETR, fetch first
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
    data = Buffer.from(imgRes.data);
    headers['Content-Type'] = 'application/octet-stream';
  } else {
    throw new Error('No image provided');
  }

  const res = await axios.post(url, data, {
    headers,
    timeout: 45000,
  });

  // HF DETR returns: [{score, label, box:{xmin,ymin,xmax,ymax}}]
  const objects = (Array.isArray(res.data) ? res.data : []).map(o => ({
    object: o.label,
    confidence: o.score,
    rectangle: {
      x: Math.round(o.box.xmin),
      y: Math.round(o.box.ymin),
      w: Math.round(o.box.xmax - o.box.xmin),
      h: Math.round(o.box.ymax - o.box.ymin)
    }
  }));

  return { objects, provider: 'huggingface', model };
}

async function detectWithAzure(imageUrl) {
  const endpoint = process.env.AZURE_ENDPOINT;
  const key = process.env.AZURE_KEY;
  if (!endpoint || !key) throw new Error('AZURE not configured');

  const response = await axios.post(
    `${endpoint.replace(/\/$/, '')}/vision/v3.2/detect`,
    { url: imageUrl },
    {
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );
  // Azure returns { objects: [{object, confidence, rectangle:{x,y,w,h}}]}
  return { ...response.data, provider: 'azure' };
}

// ---- routes
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    providers: {
      huggingface: !!process.env.HF_TOKEN,
      azure: !!(process.env.AZURE_ENDPOINT && process.env.AZURE_KEY),
      browser: true
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'browser',
        name: 'Browser (Transformers.js) – FREE, no credits',
        available: true,
        recommended: true
      },
      {
        id: 'huggingface',
        name: 'Hugging Face Inference API',
        available: !!process.env.HF_TOKEN,
        needs_key: !process.env.HF_TOKEN,
        note: 'Free tier – get token at https://huggingface.co/settings/tokens'
      },
      {
        id: 'azure',
        name: 'Azure Computer Vision',
        available: !!(process.env.AZURE_ENDPOINT && process.env.AZURE_KEY),
        needs_key: !(process.env.AZURE_ENDPOINT && process.env.AZURE_KEY)
      }
    ]
  });
});

app.post('/api/vision/detect', upload.single('image'), async (req, res) => {
  try {
    const imageUrl = req.body.imageUrl?.trim();
    const imageBuffer = req.file?.buffer;
    const provider = (req.body.provider || 'auto').toLowerCase();

    if (!imageUrl && !imageBuffer) {
      return res.status(400).json({ error: 'Provide imageUrl or upload a file as "image"' });
    }

    // If client explicitly wants browser mode, tell them to run locally
    if (provider === 'browser') {
      return res.status(400).json({ 
        error: 'browser provider runs client-side only',
        hint: 'Use the frontend with Provider = Browser – no backend call needed'
      });
    }

    let lastError = null;
    const tryOrder = provider === 'auto'
      ? ['huggingface', 'azure']
      : [provider];

    for (const p of tryOrder) {
      try {
        if (p === 'huggingface') {
          const result = await detectWithHuggingFace(imageBuffer, imageUrl);
          return res.json(result);
        }
        if (p === 'azure') {
          if (imageBuffer) {
            return res.status(400).json({ error: 'Azure provider in this server only supports imageUrl, not file upload. Use huggingface or browser mode for file uploads.' });
          }
          const result = await detectWithAzure(imageUrl);
          return res.json(result);
        }
      } catch (e) {
        lastError = e;
        const msg = e.response?.data?.error || e.response?.data || e.message;
        console.error(`Provider ${p} failed:`, msg);
        // continue to next
      }
    }

    // all failed
    const status = lastError?.response?.status || 500;
    return res.status(status === 404 ? 503 : 500).json({
      error: 'All providers failed',
      detail: String(lastError?.response?.data?.error || lastError?.message || lastError),
      hint: '1) For 100% free: use Provider = Browser in the UI (no credits). 2) For server-side: set HF_TOKEN in backend/.env – get free at https://huggingface.co/settings/tokens'
    });

  } catch (error) {
    console.error('Detect error:', error);
    res.status(500).json({ error: 'Detection failed', detail: error.message });
  }
});

// Serve frontend static
const frontendPath = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Vision Detector v2 running on http://localhost:${PORT}`);
  console.log(`   HF_TOKEN set: ${!!process.env.HF_TOKEN}`);
  console.log(`   AZURE set: ${!!(process.env.AZURE_ENDPOINT && process.env.AZURE_KEY)}`);
  console.log(`   Browser-local mode: always available (free, no credits)`);
});
