import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'viphat.db');
const db = new Database(dbPath);

function initSchema() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS stays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seq INTEGER,
      transaction_id TEXT,
      payment_type TEXT,
      check_in TEXT,
      check_out TEXT,
      room_id TEXT,
      full_name TEXT,
      nationality TEXT,
      id_number TEXT,
      issued_by TEXT,
      occupation TEXT,
      origin TEXT,
      destination TEXT,
      FOREIGN KEY(room_id) REFERENCES rooms(id)
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      guest_name TEXT NOT NULL,
      room_id TEXT NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      payment_type TEXT,
      note TEXT,
      FOREIGN KEY(room_id) REFERENCES rooms(id)
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_iso TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS cleaning (
      date_iso TEXT NOT NULL,
      room_id TEXT NOT NULL,
      PRIMARY KEY (date_iso, room_id),
      FOREIGN KEY(room_id) REFERENCES rooms(id)
    );
  `);
}

const thaiMonths = {
  'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
  'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11
};

function parseThaiDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\s+/g, ' ');
  const m = s.match(/(\d{1,2})\s+([ก-ฮ\.]+)\s+(\d{2,4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = thaiMonths[m[2]];
  let yearNum = parseInt(m[3], 10);
  if (yearNum < 100) { yearNum = 2500 + yearNum; }
  if (yearNum > 2400) { yearNum = yearNum - 543; }
  if (Number.isNaN(day) || month == null || Number.isNaN(yearNum)) return null;
  const d = new Date(yearNum, month, day);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function seedFromCSV() {
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const m = indexHtml.match(/const csvData = `([\s\S]*?)`;\n/);
  if (!m) return;
  const csvData = m[1];
  const lines = csvData.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const rooms = new Set();
  const insertRoom = db.prepare('INSERT OR IGNORE INTO rooms(id) VALUES(?)');
  const insertStay = db.prepare(`INSERT INTO stays
    (seq, transaction_id, payment_type, check_in, check_out, room_id, full_name, nationality, id_number, issued_by, occupation, origin, destination)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const trx = db.transaction(() => {
    for (const line of lines) {
      const first = line.split(',')[0];
      if (!/^\d+$/.test(first)) continue;
      const cols = line.split(',');
      while (cols.length < 13) cols.push('');
      const [seq, transactionId, paymentType, checkInRaw, room, fullName, nationality, idNumber, issuedBy, occupation, origin, destination, checkOutRaw] = cols.map(c => c.trim());
      if (room) { rooms.add(room); insertRoom.run(room); }
      const check_in = parseThaiDate(checkInRaw);
      const check_out = parseThaiDate(checkOutRaw);
      insertStay.run(parseInt(seq,10), transactionId, paymentType, check_in, check_out, room, fullName, nationality, idNumber, issuedBy, occupation, origin, destination);
    }
  });
  trx();
}

initSchema();

if (process.argv.includes('--seed')) {
  db.exec('DELETE FROM stays; DELETE FROM rooms; DELETE FROM bookings; DELETE FROM expenses; DELETE FROM cleaning;');
  seedFromCSV();
  console.log('Seeded from embedded CSV.');
}

// APIs
app.get('/api/rooms', (req, res) => {
  const rows = db.prepare('SELECT id FROM rooms ORDER BY id').all();
  res.json(rows.map(r => r.id));
});

app.get('/api/stays', (req, res) => {
  const rows = db.prepare('SELECT * FROM stays').all();
  res.json(rows);
});

app.get('/api/bookings', (req, res) => {
  const rows = db.prepare('SELECT * FROM bookings').all();
  res.json(rows);
});

app.post('/api/bookings', (req, res) => {
  const b = req.body;
  if (!b.id || !b.guest_name || !b.room_id || !b.check_in || !b.check_out) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  db.prepare('INSERT INTO bookings(id, guest_name, room_id, check_in, check_out, payment_type, note) VALUES(?,?,?,?,?,?,?)')
    .run(b.id, b.guest_name, b.room_id, b.check_in, b.check_out, b.payment_type || null, b.note || null);
  res.json({ ok: true });
});

app.delete('/api/bookings/:id', (req, res) => {
  db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/expenses', (req, res) => {
  const rows = db.prepare('SELECT * FROM expenses ORDER BY date_iso').all();
  res.json(rows);
});

app.post('/api/expenses', (req, res) => {
  const e = req.body;
  if (!e.date_iso || !e.category || typeof e.amount !== 'number') return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  db.prepare('INSERT INTO expenses(date_iso, category, amount, note) VALUES(?,?,?,?)')
    .run(e.date_iso, e.category, e.amount, e.note || null);
  res.json({ ok: true });
});

app.get('/api/cleaning/:dateIso', (req, res) => {
  const rows = db.prepare('SELECT room_id FROM cleaning WHERE date_iso = ?').all(req.params.dateIso);
  res.json(rows.map(r => r.room_id));
});

app.post('/api/cleaning', (req, res) => {
  const { date_iso, room_id, active } = req.body;
  if (!date_iso || !room_id) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  if (active) db.prepare('INSERT OR IGNORE INTO cleaning(date_iso, room_id) VALUES(?,?)').run(date_iso, room_id);
  else db.prepare('DELETE FROM cleaning WHERE date_iso = ? AND room_id = ?').run(date_iso, room_id);
  res.json({ ok: true });
});

// Serve static frontend
app.use(express.static(__dirname));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Viphat server running on http://localhost:${PORT}`);
});

