// Vision Detector – API config
// For Vercel / Netlify: set VITE_API_URL in build env, or edit here
//
// Local dev: http://localhost:5000
// Production: https://your-backend.onrender.com

export const API_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  (window.VISION_API_URL) ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : window.location.origin);
