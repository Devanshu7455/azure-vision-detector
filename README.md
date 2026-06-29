# 🔍 Vision Object Detector

A multi-provider computer vision web app for detecting objects in images using **Browser AI**, **Hugging Face**, and **Azure Computer Vision**.

## Live Demo

Live Demo: https://azure-vision-detector.vercel.app

The live demo works in **Browser mode**, so it does not require Azure credits, Hugging Face tokens, or a backend server.

---

## Overview

This project started as an Azure Computer Vision object detector. Since Azure credits can run out, the project was upgraded to support browser-based object detection and optional backend providers.

It now supports three detection modes:

1. **Browser Mode using Transformers.js**
   - Runs object detection directly in the browser.
   - No backend required.
   - No API key required.
   - Best option for demos and portfolio use.

2. **Hugging Face Inference API**
   - Optional server-side provider.
   - Requires a backend and a Hugging Face token.

3. **Azure Computer Vision**
   - Optional Microsoft Azure provider.
   - Requires Azure endpoint, key, and active credits.

The main goal of this project is to demonstrate a practical full-stack AI application with image upload, object detection, bounding-box visualization, provider fallback design, and cloud deployment.

---

## Features

- Drag-and-drop image upload
- Image URL input
- Sample image gallery
- Object detection with bounding boxes
- Confidence threshold slider
- Browser-based AI detection using Transformers.js
- Optional Hugging Face backend support
- Optional Azure Computer Vision backend support
- File upload support up to 8 MB
- Mobile-responsive UI
- Express.js backend
- Rate limiting
- Helmet security middleware
- CORS support
- Vercel frontend deployment
- Render/Docker backend deployment support

---

## Tech Stack

### Frontend

- HTML
- CSS
- JavaScript
- Canvas API
- Transformers.js
- Vercel

### Backend

- Node.js
- Express.js
- Multer
- Axios
- Helmet
- CORS
- Morgan
- Express Rate Limit

### AI Providers

- Transformers.js / Xenova models
- Hugging Face Inference API
- Azure Computer Vision API

---

## Architecture

```txt
User
 |
 | uploads image / enters image URL
 |
Frontend: HTML + CSS + JavaScript
 |
 |-- Browser Mode
 |     Runs object detection locally in browser using Transformers.js
 |
 |-- Backend Mode
       Express.js REST API
       |
       |-- Hugging Face Inference API
       |-- Azure Computer Vision API
