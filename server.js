require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*', // tighten after launch
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/products', require('./products'));
app.use('/api/orders',   require('./orders'));
app.use('/api/promos',   require('./promos'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Sara Bags API', timestamp: new Date().toISOString() });
});

app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Server error' });
});

app.listen(PORT, () => console.log(`Sara Bags API running on port ${PORT}`));
module.exports = app;
