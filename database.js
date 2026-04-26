// Pure JS JSON-based database — no native compilation needed
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const files = {
  products: path.join(DATA_DIR, 'products.json'),
  orders:   path.join(DATA_DIR, 'orders.json'),
  promos:   path.join(DATA_DIR, 'promos.json'),
};

function read(table) {
  try {
    if (!fs.existsSync(files[table])) return [];
    return JSON.parse(fs.readFileSync(files[table], 'utf8'));
  } catch { return []; }
}

function write(table, data) {
  fs.writeFileSync(files[table], JSON.stringify(data, null, 2));
}

function nextId(rows) {
  return rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1;
}

const db = {
  // ── PRODUCTS ──────────────────────────────────────
  getProducts(category) {
    let rows = read('products').filter(p => p.active !== false && p.active !== 0);
    if (category) rows = rows.filter(p => p.category === category);
    return rows;
  },
  getAllProducts() { return read('products'); },
  getProduct(id) { return read('products').find(p => p.id === parseInt(id)); },
  createProduct(data) {
    const rows = read('products');
    const product = { ...data, id: nextId(rows), active: 1, created_at: new Date().toISOString() };
    rows.push(product);
    write('products', rows);
    return product;
  },
  updateProduct(id, data) {
    const rows = read('products');
    const idx = rows.findIndex(p => p.id === parseInt(id));
    if (idx === -1) return null;
    // Explicitly update all image fields to allow clearing
    rows[idx] = { 
      ...rows[idx], 
      ...data,
      image_url: data.image_url !== undefined ? data.image_url : rows[idx].image_url,
      image_url_2: data.image_url_2 !== undefined ? data.image_url_2 : rows[idx].image_url_2,
      image_url_3: data.image_url_3 !== undefined ? data.image_url_3 : rows[idx].image_url_3
    };
    write('products', rows);
    return rows[idx];
  },
  deleteProduct(id) {
    const rows = read('products');
    const filtered = rows.filter(p => p.id !== parseInt(id));
    write('products', filtered);
    return true;
  },

  // ── ORDERS ────────────────────────────────────────
  getOrders(status, limit = 100, offset = 0) {
    let rows = read('orders').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (status) rows = rows.filter(o => o.status === status);
    return rows.slice(offset, offset + limit);
  },
  countOrders(status) {
    const rows = read('orders');
    return status ? rows.filter(o => o.status === status).length : rows.length;
  },
  getOrder(ref) { return read('orders').find(o => o.order_ref === ref); },
  createOrder(data) {
    const rows = read('orders');
    const order = { ...data, id: nextId(rows), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    rows.push(order);
    write('orders', rows);
    return order;
  },
  updateOrderStatus(ref, status) {
    const rows = read('orders');
    const idx = rows.findIndex(o => o.order_ref === ref);
    if (idx === -1) return null;
    rows[idx].status = status;
    rows[idx].updated_at = new Date().toISOString();
    write('orders', rows);
    return rows[idx];
  },

  // ── PROMOS ────────────────────────────────────────
  getPromos() { return read('promos'); },
  getPromo(code) { return read('promos').find(p => p.code === code.toUpperCase() && p.active); },
  createPromo(data) {
    const rows = read('promos');
    if (rows.find(p => p.code === data.code.toUpperCase())) throw new Error('Code already exists');
    const promo = { ...data, code: data.code.toUpperCase(), id: nextId(rows), active: 1, uses: 0, created_at: new Date().toISOString() };
    rows.push(promo);
    write('promos', rows);
    return promo;
  },
  updatePromo(id, data) {
    const rows = read('promos');
    const idx = rows.findIndex(p => p.id === parseInt(id));
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...data };
    write('promos', rows);
    return rows[idx];
  },
  deletePromo(id) {
    const rows = read('promos');
    write('promos', rows.filter(p => p.id !== parseInt(id)));
    return true;
  },
  incrementPromoUse(id) {
    const rows = read('promos');
    const idx = rows.findIndex(p => p.id === parseInt(id));
    if (idx !== -1) { rows[idx].uses = (rows[idx].uses || 0) + 1; write('promos', rows); }
  },
};

// ── Legacy default product names (used for one-time migration) ─────────
const LEGACY_PRODUCT_NAMES = [
  'The Aurora Clasp','The Obsidian','The Citrine Clutch',
  'Noir Envelope','Artisanal Canvas','Vibrant Sophistication',
];

// ── SEED ──────────────────────────────────────────────
function seed() {
  // Products: managed entirely through the admin panel — never seed defaults.
  const existing = read('products');
  if (existing.length === 0) {
    write('products', []);
    console.log('✅ Products store initialised (empty) — add products via admin panel');
  } else {
    // One-time migration: wipe the old hardcoded seed products so the store
    // is clean.  Admin-created products (different names) are left intact.
    const isAllLegacy = existing.every(p => LEGACY_PRODUCT_NAMES.includes(p.name));
    if (isAllLegacy) {
      write('products', []);
      console.log('✅ Legacy seed products cleared — add products via admin panel');
    }
  }

  // Seed promos
  if (read('promos').length === 0) {
    write('promos', [
      { id:1, code:'SARA10',   discount:10, type:'percent', active:1, uses:0, max_uses:null, created_at: new Date().toISOString() },
      { id:2, code:'HANDMADE', discount:10, type:'percent', active:1, uses:0, max_uses:null, created_at: new Date().toISOString() },
      { id:3, code:'VIP',      discount:15, type:'percent', active:1, uses:0, max_uses:null, created_at: new Date().toISOString() },
    ]);
    console.log('✅ Promo codes seeded');
  }
}

seed();
module.exports = db;
