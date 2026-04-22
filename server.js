require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'https://sarabags.vercel.app', 'http://127.0.0.1:5500'],
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/products', require('./products'));
app.use('/api/orders',   require('./orders'));
// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Sara Bags API', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════╗
  ║     Sara Bags API — Running      ║
  ║     http://localhost:${PORT}       ║
  ╚══════════════════════════════════╝
  `);
});

module.exports = app;
