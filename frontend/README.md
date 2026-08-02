# Vitals Check — Health Risk Assessment Frontend

React (Vite) frontend for the health-risk prediction project.

## Run locally
```
npm install
npm run dev
```

## Build for deployment
```
npm run build
```
This outputs static files to `dist/` — upload the contents of that folder
directly to your S3 bucket (static website hosting), then front it with
CloudFront.

## Connect to your Flask API
Set the API endpoint via an environment variable before building:
```
VITE_API_URL=http://<your-ec2-public-ip>/api/predict npm run build
```
If not set, it defaults to `http://localhost:5000/api/predict` for local
testing. If the API isn't reachable, the UI falls back to a local demo
estimate so it's still fully explorable on its own.

## What's included
- `dist-preview/` — an already-built copy so you can preview the site by
  opening `dist-preview/index.html` in a browser without running npm first.
