# PHP API Frontend (convertnodetophp/frontend)

This is a lightweight frontend that works with the PHP API running on `http://localhost:3001/api`.

How to run:

1. Start the PHP server in the repository root (example):

```powershell
& 'C:\Path\To\php.exe' -S localhost:3001 -t convertnodetophp
```

2. Open `convertnodetophp/frontend/index.html` in your browser (or serve it with a static server).

Notes:
- The frontend uses `API_BASE = 'http://localhost:3001/api'` by default.
- If your PHP server uses a different port, update `script.js`'s `API_BASE`.
