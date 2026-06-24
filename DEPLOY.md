# Deploy Guide – Vision Object Detector v2

## Option A – Frontend only – 100% FREE, 0 credits, 2 minutes
Best for most users. Browser mode needs no backend.

**Vercel (recommended)**
1. https://vercel.com → New Project → Import Git Repository
   or: `npx vercel --prod` inside `frontend/` folder
2. Framework Preset: **Other**
3. Build Command: *(empty)*
4. Output Directory: `.` (root)
5. Deploy → done
6. Your site: `https://vision-detector-xxx.vercel.app`
7. It works immediately – Browser provider needs no API keys

**Netlify**
1. Drag `frontend/` folder to https://app.netlify.com/drop
2. Done

**GitHub Pages**
1. Repo Settings → Pages → Source: Deploy from branch → main → `/frontend`
2. Wait 1 min → `https://devanshu7455.github.io/azure-vision-detector/`

No environment variables needed for Browser mode.

---

## Option B – Full stack with Hugging Face – free

### Backend → Render.com
1. https://render.com → New → Web Service → Connect GitHub repo `Devanshu7455/azure-vision-detector`
2. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance: Free
3. Environment Variables → Add:
   ```
   NODE_ENV=production
   HF_TOKEN=hf_xxxxxxxxxxxxxxxxx
   HF_MODEL=facebook/detr-resnet-50
   FRONTEND_URL=https://your-frontend.vercel.app
   ```
   Get HF_TOKEN: https://huggingface.co/settings/tokens → New → Read
4. Deploy → wait ~2 min → copy URL: `https://vision-detector-api.onrender.com`
5. Test: `https://vision-detector-api.onrender.com/api/health` → `{"ok":true,...}`

Or 1-click: use included `render.yaml` → Render → New → Blueprint → connect repo

### Frontend → Vercel (with backend)
1. `frontend/index.html` – uncomment and edit:
   ```html
   <script>window.VISION_API_URL = "https://vision-detector-api.onrender.com"</script>
   ```
2. Vercel → New Project → Import repo
   - Root Directory: `frontend`
   - Framework: Other
   - Build: (empty)
   - Deploy
3. Done – Provider dropdown will show "Hugging Face – ready"

---

## Option C – Docker – single container (API + frontend)

```bash
cd backend
docker build -t vision-detector .
docker run -p 5000:5000 \
  -e HF_TOKEN=hf_xxx \
  -e NODE_ENV=production \
  vision-detector
# open http://localhost:5000
# API at /api/*, frontend at /
```

`backend/Dockerfile` is included.

---

## Environment variables

**Backend – Render / Docker**
```
PORT=10000              # Render sets this automatically
NODE_ENV=production
HF_TOKEN=hf_...         # free – https://huggingface.co/settings/tokens
HF_MODEL=facebook/detr-resnet-50
# Optional Azure:
# AZURE_ENDPOINT=https://xxx.api.cognitive.microsoft.com
# AZURE_KEY=xxx
FRONTEND_URL=https://your-frontend.vercel.app
```

**Frontend – Vercel**
No build-time env needed. Runtime backend URL is set in `index.html`:
```html
<script>window.VISION_API_URL = "https://your-backend.onrender.com"</script>
```
Leave it commented out for Browser-only mode, or same-origin if serving frontend from Express.

For Vite users: create `frontend/.env`:
```
VITE_API_URL=https://your-backend.onrender.com
```
Then `js/config.js` will pick it up via `import.meta.env.VITE_API_URL`.

---

## CI – GitHub Actions

Included at `.github/workflows/ci.yml`
- Tests backend `node -c server.js`
- Verifies frontend files exist
- Runs on every push/PR

No secrets needed unless you add tests that call HF.

---

## Troubleshooting deploy

**Vercel: "Transformers.js model fails to load"**
→ Normal. Add these headers – already in `frontend/vercel.json`:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```
These are required for ONNX WASM threads.

If still failing, in `frontend/js/app.js` change:
```js
const det = await pipeline('object-detection', 'Xenova/detr-resnet-50', { device: 'wasm' })
```

**Render free instance sleeps**
→ First request after 15 min idle takes ~50s (cold start).
Fix: UptimeRobot ping `https://your-backend.onrender.com/api/health` every 5 min – free.

**Hugging Face 503 "Model is loading"**
→ Free Inference API cold start. Wait 20s, retry. Or just use Browser mode.

**CORS error**
→ Backend uses `cors({ origin: true })` – allows all. Tighten in production by setting `FRONTEND_URL` env var.

**Images from Unsplash don't detect in Browser mode**
→ CORS. Use Upload tab instead, or the Sample images (Unsplash with proper CORS).

---

## Cost summary

| Setup | Monthly cost |
|-------|-------------|
| Frontend only – Vercel + Browser mode | **$0** |
| Backend – Render Free + HF free token | **$0** |
| Backend – Render Starter ($7) – no sleep | $7 |
| Azure Computer Vision | ~$1 per 1000 images – credits finish fast |

Recommendation: Ship Frontend-only on Vercel. $0 forever, no keys, no backend to maintain.
