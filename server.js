// server.js (CommonJS)
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ensure uploads dir exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// serve static frontend from /public
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// basic security / parse
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// multer storage config (disk)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    // create safe unique filename: timestamp-rand-ext
    const ts = Date.now();
    const rand = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname) || (file.mimetype ? '.' + file.mimetype.split('/')[1] : '');
    cb(null, `${ts}-${rand}${ext}`);
  }
});

// allow only images and small sizes
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

// single endpoint to accept photo + (optional) qr + fields
// 'photo' and optional 'qr' are the file field names
app.post('/upload', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'qr', maxCount: 1 }]), (req, res) => {
  try {
    // basic validation
    if (!req.files || !req.files.photo || req.files.photo.length === 0) {
      return res.status(400).json({ ok: false, error: 'photo is required' });
    }

    const photo = req.files.photo[0];
    const qr = (req.files.qr && req.files.qr[0]) ? req.files.qr[0] : null;

    // form fields
    const account = (req.body.account || '').trim();
    const payerPhone = (req.body.payerPhone || '').trim();
    const latitude = req.body.latitude ? Number(req.body.latitude) : null;
    const longitude = req.body.longitude ? Number(req.body.longitude) : null;

    // create metadata
    const id = crypto.randomBytes(12).toString('hex');
    const meta = {
      id,
      timestamp: new Date().toISOString(),
      ip: req.ip || req.headers['x-forwarded-for'] || null,
      photoFilename: path.basename(photo.path || photo.filename),
      qrFilename: qr ? path.basename(qr.path || qr.filename) : null,
      account,
      payerPhone,
      latitude,
      longitude,
      userAgent: req.headers['user-agent'] || null,
    };

    // write metadata file (one JSON per upload)
    const metaPath = path.join(UPLOADS_DIR, `${meta.id}.json`);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    // return success with minimal info
    return res.json({ ok: true, id, photo: meta.photoFilename, qr: meta.qrFilename });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

// health check
app.get('/healthz', (req, res) => res.json({ ok: true }));

// fallback route: serve index.html for SPA (so root loads your page)
app.get('*', (req, res) => {
  // if requesting files from uploads folder — deny listing but allow direct access by filename if needed:
  const urlPath = req.path;
  if (urlPath.startsWith('/uploads/')) {
    return res.status(403).send('Forbidden');
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} — node ${process.version}`);
  console.log(`Serving frontend from ${PUBLIC_DIR}`);
});