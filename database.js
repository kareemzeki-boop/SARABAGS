// Pure JS JSON-based database — no native compilation needed
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
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
    rows[idx] = { ...rows[idx], ...data };
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

// ── SEED ──────────────────────────────────────────────
function seed() {
  // Seed products
  if (read('products').length === 0) {
    const products = [
      { name:'The Aurora Clasp', subtitle:'Pebble-grain · Pearls · Gold', description:'Pebble-grain leather with a gold kiss-lock frame and freshwater pearl chain. Moves effortlessly from morning meetings to evening galas.', price:285, category:'Clasp', colours:['Amber','Noir','Ivory'], unavail:[], bg_text:'AURORA', image_key:'orange_clasp', active:1 },
      { name:'The Obsidian', subtitle:'Diamond-quilted wristlet', description:'48 hours of hand-stitching create the signature diamond quilted pattern. A wristlet that doubles as sculptural art.', price:240, category:'Wristlet', colours:['Noir','Olive'], unavail:[], bg_text:'NOIR', image_key:'black_quilted', active:1 },
      { name:'The Citrine Clutch', subtitle:'Quilted leather pouch', description:'A bold citrine-yellow quilted clutch that transforms any neutral outfit into a statement.', price:195, category:'Clutch', colours:['Citrine','Blush'], unavail:[], bg_text:'CITRINE', image_key:'yellow_bag', active:1 },
      { name:'Noir Envelope', subtitle:'Snakeskin-texture wristlet', description:'Sharp angles hand-cut with mathematical accuracy. Snakeskin-embossed leather that transitions from studio to social hours.', price:220, category:'Wristlet', colours:['Noir'], unavail:[], bg_text:'ENVELOPE', image_key:'snakeskin', active:1 },
      { name:'Artisanal Canvas', subtitle:'Butterfly embroidery', description:'Intricate butterfly embroidery meets versatile design. A canvas bag that brings gallery-worthy artistry to your daily carry.', price:175, category:'Canvas', colours:['Natural','Stone'], unavail:[], bg_text:'FLORA', image_key:'butterfly', active:1 },
      { name:'Vibrant Sophistication', subtitle:'Pearl-chain clasp bag', description:'A sun-drenched orange hue paired with freshwater pearls and a gold frame. Perfect for high-profile formal occasions.', price:265, category:'Clasp', colours:['Tangerine','Rouge'], unavail:[], bg_text:'VIBRANT', image_key:'orange_held', active:1 },
    ];
    const rows = [];
    products.forEach((p, i) => rows.push({ ...p, id: i+1, created_at: new Date().toISOString() }));
    write('products', rows);
    console.log('✅ Products seeded');
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
