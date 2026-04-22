# Sara Bags — MVP

Handmade leather bags e-commerce app. Mobile web frontend + Node.js/Express backend + SQLite database.

---

## Project Structure

```
sara-bags/
├── frontend/
│   ├── index.html      ← Mobile web app (deploy to Vercel)
│   ├── admin.html      ← Order management dashboard
│   └── vercel.json     ← Vercel config
├── backend/
│   ├── server.js       ← Express server (deploy to Railway)
│   ├── package.json
│   ├── Procfile        ← Railway process config
│   ├── .env.example    ← Copy to .env and fill in values
│   ├── db/
│   │   └── database.js ← SQLite schema + seed data
│   └── routes/
│       ├── products.js ← GET /api/products
│       └── orders.js   ← POST/GET /api/orders
└── README.md
```

---

## Quick Start (Local)

### 1. Backend

```bash
cd backend
cp .env.example .env          # fill in your values
npm install
npm run dev                   # starts on http://localhost:3001
```

### 2. Frontend

Open `frontend/index.html` in a browser, or use Live Server in VS Code.

Update the API URL at the top of `index.html`:
```js
const API = 'http://localhost:3001/api';
```

### 3. Admin Panel

Open `frontend/admin.html` in a browser.

Use the `ADMIN_KEY` from your `.env` file to log in.

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | — | Server health check |
| GET | `/api/products` | — | List all products |
| GET | `/api/products?category=Clasp` | — | Filter by category |
| GET | `/api/products/:id` | — | Single product |
| POST | `/api/orders` | — | Place an order |
| GET | `/api/orders` | Admin | List all orders |
| GET | `/api/orders/:ref` | — | Get order by ref |
| PATCH | `/api/orders/:ref/status` | Admin | Update order status |
| POST | `/api/orders/validate-promo` | — | Validate promo code |

### Place Order — Request Body
```json
{
  "customer_name": "Sara",
  "customer_phone": "+971501234567",
  "customer_email": "sara@email.com",
  "items": [
    { "product_id": 1, "colour": "Amber", "qty": 1 }
  ],
  "delivery_option": "try_on",
  "promo_code": "SARA10"
}
```

### Place Order — Response
```json
{
  "success": true,
  "data": {
    "order_ref": "SB-ABC123-XYZ",
    "order_id": 1,
    "total": 270,
    "whatsapp_link": "https://wa.me/971501234567?text=..."
  }
}
```

---

## Deploy

### Backend → Railway

1. Push `backend/` folder to a GitHub repo
2. Create new Railway project → Deploy from GitHub
3. Set environment variables in Railway dashboard (copy from `.env.example`)
4. Railway will auto-detect `Procfile` and start `node server.js`

### Frontend → Vercel

1. Push `frontend/` folder to GitHub
2. Create new Vercel project → Import from GitHub
3. Set root directory to `frontend/`
4. **Update the `API` constant** in `index.html` to your Railway URL:
   ```js
   const API = 'https://your-app.railway.app/api';
   ```

---

## Promo Codes

Default codes (seeded automatically):

| Code | Discount |
|------|----------|
| `SARA10` | 10% off |
| `HANDMADE` | 10% off |
| `VIP` | 15% off |

---

## Order Statuses

`pending` → `confirmed` → `shipped` → `delivered`

Or: `cancelled` at any stage.

---

## WhatsApp Integration

When an order is placed, the API returns a pre-filled WhatsApp link. Clicking it opens a WhatsApp chat with the order summary. 

To configure your number, set `WHATSAPP_NUMBER` in `.env` (digits only, e.g. `971501234567` for UAE).

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla HTML/CSS/JS |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Frontend Deploy | Vercel |
| Backend Deploy | Railway |
| Notifications | WhatsApp (wa.me links) |
