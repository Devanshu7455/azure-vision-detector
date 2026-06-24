# 🔍 Vision Object Detector – Free, No Azure Credits Needed

Detect objects in images with 3 providers:
1. **Browser (Transformers.js) – 100% FREE, no API keys, offline**
2. **Hugging Face Inference API – free token**
3. **Azure Computer Vision – optional**

Your original repo used only Azure and credits ran out. This v2 fixes that – it works completely free in the browser, with Hugging Face and Azure as optional server-side fallbacks.

Live demo: deploy `frontend/` to GitHub Pages / Vercel – Browser mode works with zero backend.

---

## Quick Start – 100% Free, No Keys

### Option A – Browser only (easiest, 0 credits)
```bash
cd frontend
# just open index.html in your browser, or:
npx serve .
# open http://localhost:3000
```
- Choose Provider = **Browser**
- Upload an image / paste URL / click a sample
- First run downloads ~40 MB AI model (Xenova/detr-resnet-50), cached after
- Detection runs locally in your browser – no server, no credits, no API key

### Option B – With backend (Hugging Face, still free)
```bash
cd backend
cp .env.example .env
# edit .env, set:
# HF_TOKEN=hf_xxxxxxxxxxxxxxxxx
# Get free token: https://huggingface.co/settings/tokens (Read role is enough)
npm install
npm run dev
# → http://localhost:5000
```
Open frontend (above) and choose Provider = **Auto** or **Hugging Face**

You can now upload files too (not just URLs).

### Option C – Azure (if you get credits again)
In `backend/.env`:
```
AZURE_ENDPOINT=https://YOUR_REGION.api.cognitive.microsoft.com
AZURE_KEY=your_key
```
Then choose Provider = **Azure** in the UI.

---

## Features

- ✅ Drag & drop upload, image URL, sample gallery
- ✅ Bounding boxes drawn on image
- ✅ Confidence threshold slider
- ✅ 3 providers with auto-fallback
- ✅ File upload support (8 MB max) – original repo was URL-only
- ✅ Rate limiting, helmet, CORS
- ✅ Mobile responsive
- ✅ No API keys exposed to frontend
- ✅ Works 100% offline after first model download (Browser mode)

---

## API

`POST /api/vision/detect`

Form-data (file upload):
```
image: <file>
provider: browser|auto|huggingface|azure
```

Or JSON:
```json
{ "imageUrl": "https://...", "provider": "auto" }
```

Response:
```json
{
  "objects": [
    { "object": "person", "confidence": 0.98, "rectangle": {"x":120,"y":40,"w":200,"h":400} }
  ],
  "provider": "huggingface",
  "model": "facebook/detr-resnet-50"
}
```

`GET /api/health` – provider availability
`GET /api/providers` – list providers

---

## Deploy

**Frontend only (Browser mode – free forever)**
- Vercel / Netlify / GitHub Pages
- Just upload the `frontend/` folder – no build step
- Works 100% client-side

**Full stack (with Hugging Face backend)**
- Backend → Render.com Free
  Env vars: `HF_TOKEN`, `NODE_ENV=production`
- Frontend → Vercel
  Set `API_URL` in `frontend/js/app.js` → change `API_URL = 'https://your-backend.onrender.com'`
  Or better: create `frontend/js/config.js` with `export const API_URL = import.meta.env.VITE_API_URL`

---

## Why this fixes your Azure credits problem

| Provider | Cost | Speed | File upload | Offline |
|----------|------|-------|-------------|---------|
| **Browser (Transformers.js)** | **$0 forever** | ~1-3s after model load | Yes | Yes |
| **Hugging Face** | Free tier, generous | ~1-2s | Yes | No |
| **Azure** | Pay per call – credits finish | ~0.5s | URL only* | No |

*Azure in this repo is URL-only. HF + Browser support file uploads.

**Recommended:** Use **Browser mode** for demos / personal use – zero cost, zero keys. Use **Hugging Face** for production server-side with a free token.

---

## Environment variables – backend/.env

```
# FREE – pick one:
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # https://huggingface.co/settings/tokens
HF_MODEL=facebook/detr-resnet-50

# Optional – Azure (credits needed)
# AZURE_ENDPOINT=https://YOUR_REGION.api.cognitive.microsoft.com
# AZURE_KEY=xxxxxxxx

PORT=5000
FRONTEND_URL=http://localhost:5173
```

No keys at all? – Just use Browser mode in the frontend, it works without a backend.

---

## File structure
```
backend/
  server.js          # Express, 3 providers, file upload, rate limit
  package.json
  .env.example

frontend/
  index.html         # Upload / URL / Samples tabs, canvas overlay
  css/style.css      # Clean Inter UI, mobile responsive
  js/app.js          # Transformers.js browser detector + API client
```

---

## Differences vs original azure-vision-detector v1

| | v1 (original) | v2 (fixed) |
|---|---------------|------------|
| Providers | Azure only | Browser (free) + HF (free) + Azure |
| Credits needed? | Yes – you ran out | No – browser mode $0 forever |
| File upload | No – URL only | Yes – drag & drop, 8 MB |
| Bounding boxes | List only | Drawn on image canvas |
| UI | Basic input + list | Upload tabs, sample gallery, threshold slider, provider picker |
| Security | Basic | Helmet, rate-limit, morgan, proper errors |
| Mobile | No | Responsive |
| API keys in frontend? | No (good) | Still no |
| Works offline? | No | Yes – Browser mode |

---

## Troubleshooting

**"All providers failed" / "HF_TOKEN not configured"**
→ That's fine. Switch Provider dropdown to **Browser** – works with zero keys.

**Browser mode stuck on "Loading AI model"**
→ First load downloads ~40 MB. Wait 30-60s on slow internet. Check DevTools Network tab. Model is cached after.

**Hugging Face returns 503 "Model is loading"**
→ Free HF Inference API cold-starts. Wait 20s and retry, or just use Browser mode.

**Azure 401 / credits finished**
→ Ignore Azure. Use Browser or Hugging Face. Delete AZURE_ENDPOINT / AZURE_KEY from .env if you want.

**CORS error loading image URL**
→ Some sites block `<img crossorigin>`. Use Upload tab instead, or click a Sample image.

**File upload fails on Azure provider**
→ Azure route in this server only accepts imageUrl. Use Provider = Hugging Face or Browser for file uploads.

---

## License
MIT

---

Built as a drop-in replacement for https://github.com/Devanshu7455/azure-vision-detector – same API shape (`POST /api/vision/detect` with `{imageUrl}`), so your existing frontend still works, but now with 2 free providers added.
