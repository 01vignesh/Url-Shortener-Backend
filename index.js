// index.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');

const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Load or initialize data
let db = { urls: {} };
try {
  if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  }
} catch (err) {
  console.error('Error reading data file:', err);
}

// Helper to persist
function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});


// Basic URL validation
function isValidUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Create short URL
app.post('/api/shorten', (req, res) => {
  const { url } = req.body;
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Include http:// or https:// ' });
  }

  // Try to see if same URL already has a code
  const existing = Object.entries(db.urls).find(([, v]) => v.original === url);
  if (existing) {
    const code = existing[0];
    return res.json({ code, shortUrl: `${BASE_URL}/s/${code}`, original: url, clicks: db.urls[code].clicks });
  }

  const code = nanoid(7); // 7-char short code
  db.urls[code] = { original: url, clicks: 0, createdAt: new Date().toISOString() };
  save();
  res.json({ code, shortUrl: `${BASE_URL}/s/${code}`, original: url, clicks: 0 });
});

// List all created URLs (session/all)
app.get('/api/urls', (req, res) => {
  // Return array
  const list = Object.entries(db.urls).map(([code, data]) => ({ code, ...data, shortUrl: `${BASE_URL}/s/${code}` }));
  res.json(list);
});

// Redirect route
app.get('/s/:code', (req, res) => {
  const code = req.params.code;
  const entry = db.urls[code];
  if (!entry) return res.status(404).send('Short URL not found');
  // increment click count and save
  entry.clicks = (entry.clicks || 0) + 1;
  save();
  // Redirect
  res.redirect(entry.original);
});

// Simple health route
app.get('/', (req, res) => {
  res.send('URL Shortener backend is running.');
});

app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}. BASE_URL=${BASE_URL}`);
});
