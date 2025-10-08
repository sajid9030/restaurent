// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.sqlite');
const ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';

if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    price REAL,
    available INTEGER DEFAULT 1
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    phone TEXT,
    items TEXT,
    total REAL,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // seed menu if empty
  db.get("SELECT COUNT(*) as c FROM menu", (err, row) => {
    if (err) return console.error(err);
    if (row.c === 0) {
      const stmt = db.prepare("INSERT INTO menu (name,description,price,available) VALUES (?,?,?,1)");
      const seed = [
        ["Margherita Pizza", "Classic cheese pizza", 7.99],
        ["Veg Burger", "Veg patty with lettuce, tomato", 5.5],
        ["French Fries", "Crispy shoestring fries", 2.5],
        ["Coke (330ml)", "Soft drink", 1.2]
      ];
      seed.forEach(s => stmt.run(s[0], s[1], s[2]));
      stmt.finalize();
      console.log("Seeded menu items.");
    }
  });
});

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Helpers
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required.');
  }
  const token = auth.split(' ')[1] || '';
  const decoded = Buffer.from(token, 'base64').toString();
  const parts = decoded.split(':');
  const pass = parts[1] || '';
  if (pass === ADMIN_PASS) return next();
  return res.status(403).send('Forbidden');
}

// Front page
app.get('/', (req, res) => {
  db.all("SELECT * FROM menu WHERE available=1", (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.render('index', { menu: rows });
  });
});

// API: menu JSON
app.get('/api/menu', (req, res) => {
  db.all("SELECT * FROM menu WHERE available=1", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Place order (accept JSON or form)
app.post('/order', (req, res) => {
  const { customer_name, phone, items, total } = req.body;
  let itemsJson = items;
  if (typeof items !== 'string') itemsJson = JSON.stringify(items || []);
  if (!customer_name || !phone || !itemsJson) {
    return res.status(400).send('Missing fields.');
  }
  const stmt = db.prepare("INSERT INTO orders (customer_name, phone, items, total, status) VALUES (?,?,?,?, 'new')");
  stmt.run(customer_name, phone, itemsJson, total || 0, function(err) {
    if (err) return res.status(500).send('DB insert error');
    const orderId = this.lastID;
    res.redirect(`/order/${orderId}`);
  });
});

// Confirmation page
app.get('/order/:id', (req, res) => {
  db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).send('Order not found');
    let items = [];
    try { items = JSON.parse(row.items); } catch(e){ items = []; }
    res.render('order_confirm', { order: row, items });
  });
});

// Admin dashboard (protected)
app.get('/admin', requireAdmin, (req, res) => {
  db.all("SELECT * FROM orders ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).send('DB error');
    // parse items
    rows = rows.map(r => {
      try { r.items_parsed = JSON.parse(r.items); } catch(e){ r.items_parsed = []; }
      return r;
    });
    res.render('admin', { orders: rows });
  });
});

// Update order status
app.post('/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  db.run("UPDATE orders SET status = ? WHERE id = ?", [status || 'new', req.params.id], function(err) {
    if (err) return res.status(500).send('DB update error');
    res.redirect('/admin');
  });
});

// Simple API to fetch orders (admin)
app.get('/api/orders', requireAdmin, (req, res) => {
  db.all("SELECT * FROM orders ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
