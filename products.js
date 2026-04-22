const express = require('express');
const router = express.Router();
const db = require('./database');

// GET /api/products
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM products WHERE active = 1';
    const params = [];

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY id ASC';
    const products = db.prepare(query).all(...params);

    // Parse JSON fields
    const parsed = products.map(p => ({
      ...p,
      colours: JSON.parse(p.colours),
      unavail: JSON.parse(p.unavail)
    }));

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    res.json({
      success: true,
      data: {
        ...product,
        colours: JSON.parse(product.colours),
        unavail: JSON.parse(product.unavail)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

// GET /api/products/categories/list
router.get('/categories/list', (req, res) => {
  try {
    const cats = db.prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category').all();
    res.json({ success: true, data: ['All', ...cats.map(c => c.category)] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

module.exports = router;
