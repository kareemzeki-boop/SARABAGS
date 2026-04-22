const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('./database');

// Generate order reference
const generateRef = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `SB-${ts}-${rand}`;
};

// Validation rules
const orderValidation = [
  body('customer_name').trim().notEmpty().withMessage('Name is required'),
  body('customer_phone').trim().notEmpty().withMessage('Phone is required'),
  body('customer_email').optional().isEmail().withMessage('Invalid email'),
  body('items').isArray({ min: 1 }).withMessage('Cart cannot be empty'),
  body('items.*.product_id').isInt().withMessage('Invalid product ID'),
  body('items.*.qty').isInt({ min: 1 }).withMessage('Invalid quantity'),
  body('delivery_option').isIn(['try_on', 'standard']).withMessage('Invalid delivery option'),
];

// POST /api/orders — place a new order
router.post('/', orderValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { customer_name, customer_phone, customer_email, items, delivery_option, promo_code, notes } = req.body;

    // Validate products & calculate total
    let subtotal = 0;
    const enrichedItems = [];

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id);
      if (!product) return res.status(400).json({ success: false, error: `Product ID ${item.product_id} not found` });

      const lineTotal = product.price * item.qty;
      subtotal += lineTotal;
      enrichedItems.push({
        product_id: product.id,
        name: product.name,
        subtitle: product.subtitle,
        colour: item.colour || 'Default',
        qty: item.qty,
        unit_price: product.price,
        line_total: lineTotal
      });
    }

    // Delivery cost
    const delivery_cost = delivery_option === 'try_on' ? 15 : 0;

    // Promo code
    let discount = 0;
    let validPromo = null;
    if (promo_code) {
      const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND active = 1').get(promo_code.toUpperCase());
      if (promo) {
        if (!promo.max_uses || promo.uses < promo.max_uses) {
          discount = promo.type === 'percent' ? Math.round(subtotal * promo.discount / 100) : promo.discount;
          validPromo = promo;
        }
      }
    }

    const total = subtotal - discount + delivery_cost;
    const order_ref = generateRef();

    // Insert order
    const result = db.prepare(`
      INSERT INTO orders (order_ref, customer_name, customer_phone, customer_email, items, subtotal, delivery_option, delivery_cost, promo_code, discount, total, notes)
      VALUES (@order_ref, @customer_name, @customer_phone, @customer_email, @items, @subtotal, @delivery_option, @delivery_cost, @promo_code, @discount, @total, @notes)
    `).run({
      order_ref,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      items: JSON.stringify(enrichedItems),
      subtotal,
      delivery_option,
      delivery_cost,
      promo_code: validPromo ? promo_code.toUpperCase() : null,
      discount,
      total,
      notes: notes || null
    });

    // Increment promo use count
    if (validPromo) {
      db.prepare('UPDATE promo_codes SET uses = uses + 1 WHERE id = ?').run(validPromo.id);
    }

    // Build WhatsApp message
    const itemLines = enrichedItems.map(i => `• ${i.name} (${i.colour}) x${i.qty} — $${i.line_total}`).join('\n');
    const waMessage = encodeURIComponent(
      `🛍️ *New Sara Bags Order!*\n\n` +
      `*Ref:* ${order_ref}\n` +
      `*Customer:* ${customer_name}\n` +
      `*Phone:* ${customer_phone}\n\n` +
      `*Items:*\n${itemLines}\n\n` +
      `*Delivery:* ${delivery_option === 'try_on' ? 'Try On (+$15)' : 'Standard (Free)'}\n` +
      (discount > 0 ? `*Discount:* -$${discount}\n` : '') +
      `*Total:* $${total}`
    );

    const waPhone = process.env.WHATSAPP_NUMBER || '971501234567';
    const waLink = `https://wa.me/${waPhone}?text=${waMessage}`;

    res.status(201).json({
      success: true,
      data: {
        order_ref,
        order_id: result.lastInsertRowid,
        total,
        whatsapp_link: waLink,
        message: 'Order placed successfully'
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to place order' });
  }
});

// GET /api/orders — list all orders (admin)
router.get('/', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM orders';
    const params = [];
    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const orders = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as c FROM orders' + (status ? ' WHERE status = ?' : '')).get(...(status ? [status] : [])).c;

    res.json({
      success: true,
      data: orders.map(o => ({ ...o, items: JSON.parse(o.items) })),
      meta: { total, limit: Number(limit), offset: Number(offset) }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:ref — get single order by ref
router.get('/:ref', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE order_ref = ?').get(req.params.ref);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: { ...order, items: JSON.parse(order.items) } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// PATCH /api/orders/:ref/status — update order status (admin)
router.patch('/:ref/status', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  try {
    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_ref = ?").run(status, req.params.ref);
    res.json({ success: true, message: `Order ${req.params.ref} → ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update order' });
  }
});

// POST /api/orders/validate-promo — validate a promo code
router.post('/validate-promo', (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Code required' });

    const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND active = 1').get(code.toUpperCase());
    if (!promo || (promo.max_uses && promo.uses >= promo.max_uses)) {
      return res.status(404).json({ success: false, error: 'Invalid or expired code' });
    }

    const discount = promo.type === 'percent'
      ? Math.round((subtotal || 0) * promo.discount / 100)
      : promo.discount;

    res.json({ success: true, data: { code: promo.code, discount, type: promo.type, percent: promo.discount } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to validate code' });
  }
});

module.exports = router;
