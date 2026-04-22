const express = require('express');
const router = express.Router();
const db = require('./database');

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
const adminAuth = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

// GET /api/products/categories/list — must come before /:id
router.get('/categories/list', (req, res) => {
  try {
    const cats = db.prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category').all();
    res.json({ success: true, data: ['All', ...cats.map(c => c.category)] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// GET /api/products/admin/all — must come before /:id
router.get('/admin/all', adminAuth, (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
    const parsed = products.map(p => ({
      ...p,
      colours: JSON.parse(p.colours),
      unavail: JSON.parse(p.unavail)
    }));
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

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
      data: { ...product, colours: JSON.parse(product.colours), unavail: JSON.parse(product.unavail) }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// POST /api/products/admin — create new product
router.post('/admin', adminAuth, (req, res) => {
  try {
    const { name, subtitle, description, price, category, colours, unavail, image_key, bg_text } = req.body;
    if (!name || price === undefined || !category) {
      return res.status(400).json({ success: false, error: 'name, price and category are required' });
    }
    const result = db.prepare(`
      INSERT INTO products (name, subtitle, description, price, category, colours, unavail, image_key, bg_text, active)
      VALUES (@name, @subtitle, @description, @price, @category, @colours, @unavail, @image_key, @bg_text, 1)
    `).run({
      name,
      subtitle: subtitle || '',
      description: description || '',
      price: parseFloat(price),
      category,
      colours: JSON.stringify(Array.isArray(colours) ? colours : []),
      unavail: JSON.stringify(Array.isArray(unavail) ? unavail : []),
      image_key: image_key || '',
      bg_text: bg_text || ''
    });
    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      success: true,
      data: { ...newProduct, colours: JSON.parse(newProduct.colours), unavail: JSON.parse(newProduct.unavail) }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

// PATCH /api/products/admin/:id — update product fields
router.patch('/admin/:id', adminAuth, (req, res) => {
  try {
    const { name, subtitle, description, price, category, colours, unavail, image_key, bg_text, active } = req.body;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Product not found' });

    db.prepare(`
      UPDATE products SET
        name = @name, subtitle = @subtitle, description = @description,
        price = @price, category = @category, colours = @colours,
        unavail = @unavail, image_key = @image_key, bg_text = @bg_text,
        active = @active
      WHERE id = @id
    `).run({
      id: req.params.id,
      name:        name        !== undefined ? name        : existing.name,
      subtitle:    subtitle    !== undefined ? subtitle    : existing.subtitle,
      description: description !== undefined ? description : existing.description,
      price:       price       !== undefined ? parseFloat(price) : existing.price,
      category:    category    !== undefined ? category    : existing.category,
      colours:     colours     !== undefined ? JSON.stringify(Array.isArray(colours) ? colours : []) : existing.colours,
      unavail:     unavail     !== undefined ? JSON.stringify(Array.isArray(unavail) ? unavail : []) : existing.unavail,
      image_key:   image_key   !== undefined ? image_key   : existing.image_key,
      bg_text:     bg_text     !== undefined ? bg_text     : existing.bg_text,
      active:      active      !== undefined ? (active ? 1 : 0) : existing.active
    });

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      data: { ...updated, colours: JSON.parse(updated.colours), unavail: JSON.parse(updated.unavail) }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

// PATCH /api/products/admin/:id/restore — restore a deactivated product
router.patch('/admin/:id/restore', adminAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Product not found' });
    db.prepare('UPDATE products SET active = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: `Product ${req.params.id} restored` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to restore product' });
  }
});

// DELETE /api/products/admin/:id — soft delete (deactivate)
router.delete('/admin/:id', adminAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Product not found' });
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: `Product ${req.params.id} deactivated` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to deactivate product' });
  }
});

// DELETE /api/products/admin/:id/permanent — hard delete
router.delete('/admin/:id/permanent', adminAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Product not found' });
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: `Product ${req.params.id} permanently deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

module.exports = router;
