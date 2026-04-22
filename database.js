const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/sara_bags.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    subtitle    TEXT,
    description TEXT,
    price       REAL NOT NULL,
    category    TEXT NOT NULL,
    colours     TEXT NOT NULL DEFAULT '[]',
    unavail     TEXT NOT NULL DEFAULT '[]',
    image_key   TEXT,
    bg_text     TEXT,
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_ref       TEXT UNIQUE NOT NULL,
    customer_name   TEXT NOT NULL,
    customer_phone  TEXT NOT NULL,
    customer_email  TEXT,
    items           TEXT NOT NULL,
    subtotal        REAL NOT NULL,
    delivery_option TEXT DEFAULT 'standard',
    delivery_cost   REAL DEFAULT 0,
    promo_code      TEXT,
    discount        REAL DEFAULT 0,
    total           REAL NOT NULL,
    notes           TEXT,
    status          TEXT DEFAULT 'pending',
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT UNIQUE NOT NULL,
    discount   REAL NOT NULL,
    type       TEXT DEFAULT 'percent',
    active     INTEGER DEFAULT 1,
    uses       INTEGER DEFAULT 0,
    max_uses   INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── SEED PRODUCTS ───────────────────────────────────────────────────────────

const seedProducts = () => {
  const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO products (name, subtitle, description, price, category, colours, unavail, image_key, bg_text)
    VALUES (@name, @subtitle, @description, @price, @category, @colours, @unavail, @image_key, @bg_text)
  `);

  const products = [
    {
      name: 'The Aurora Clasp',
      subtitle: 'Pebble-grain · Pearls · Gold',
      description: 'Pebble-grain leather with a gold kiss-lock frame and freshwater pearl chain. Moves effortlessly from morning meetings to evening galas. Each pearl is hand-selected and individually fastened.',
      price: 285,
      category: 'Clasp',
      colours: JSON.stringify(['Amber', 'Noir', 'Ivory']),
      unavail: JSON.stringify([]),
      image_key: 'orange_clasp',
      bg_text: 'AURORA'
    },
    {
      name: 'The Obsidian',
      subtitle: 'Diamond-quilted wristlet',
      description: '48 hours of hand-stitching create the signature diamond quilted pattern. A wristlet that doubles as sculptural art. Crafted in the finest pebble-grain leather.',
      price: 240,
      category: 'Wristlet',
      colours: JSON.stringify(['Noir', 'Olive']),
      unavail: JSON.stringify([]),
      image_key: 'black_quilted',
      bg_text: 'NOIR'
    },
    {
      name: 'The Citrine Clutch',
      subtitle: 'Quilted leather pouch',
      description: 'A bold citrine-yellow quilted clutch that transforms any neutral outfit into a statement. Crafted for the woman who refuses to blend in.',
      price: 195,
      category: 'Clutch',
      colours: JSON.stringify(['Citrine', 'Blush']),
      unavail: JSON.stringify([]),
      image_key: 'yellow_bag',
      bg_text: 'CITRINE'
    },
    {
      name: 'Noir Envelope',
      subtitle: 'Snakeskin-texture wristlet',
      description: 'Sharp angles hand-cut with mathematical accuracy. Snakeskin-embossed leather that transitions from the studio to social hours without missing a beat.',
      price: 220,
      category: 'Wristlet',
      colours: JSON.stringify(['Noir']),
      unavail: JSON.stringify([]),
      image_key: 'snakeskin',
      bg_text: 'ENVELOPE'
    },
    {
      name: 'Artisanal Canvas',
      subtitle: 'Butterfly embroidery',
      description: 'Intricate butterfly embroidery meets versatile design. A canvas bag that brings gallery-worthy artistry to your daily carry. Each butterfly is embroidered by hand.',
      price: 175,
      category: 'Canvas',
      colours: JSON.stringify(['Natural', 'Stone']),
      unavail: JSON.stringify([]),
      image_key: 'butterfly',
      bg_text: 'FLORA'
    },
    {
      name: 'Vibrant Sophistication',
      subtitle: 'Pearl-chain clasp bag',
      description: 'A sun-drenched orange hue paired with freshwater pearls and a gold frame. Perfect for high-profile formal occasions and evening events.',
      price: 265,
      category: 'Clasp',
      colours: JSON.stringify(['Tangerine', 'Rouge']),
      unavail: JSON.stringify([]),
      image_key: 'orange_held',
      bg_text: 'VIBRANT'
    }
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) insert.run(item);
  });
  insertMany(products);
  console.log('✅ Products seeded');
};

// ─── SEED PROMO CODES ────────────────────────────────────────────────────────

const seedPromoCodes = () => {
  const count = db.prepare('SELECT COUNT(*) as c FROM promo_codes').get().c;
  if (count > 0) return;

  db.prepare(`INSERT INTO promo_codes (code, discount, type) VALUES (?, ?, ?)`).run('SARA10', 10, 'percent');
  db.prepare(`INSERT INTO promo_codes (code, discount, type) VALUES (?, ?, ?)`).run('HANDMADE', 10, 'percent');
  db.prepare(`INSERT INTO promo_codes (code, discount, type) VALUES (?, ?, ?)`).run('VIP', 15, 'percent');
  console.log('✅ Promo codes seeded');
};

seedProducts();
seedPromoCodes();

module.exports = db;
