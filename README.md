# วิพัฒน์โฮเทล (Viphat Hotel Management Pro)

โปรเจกต์แอปจัดการโรงแรมภาษาไทยแบบหน้าเดียว (SPA) + Backend Node.js/SQLite

- Frontend: `index.html` (Tailwind + Flowbite)
- Backend: `server.js` (Express + better-sqlite3)
- ฐานข้อมูล: `viphat.db`

## วิธีเริ่มต้น (บนคอมพิวเตอร์หรือ Android/Termux)

```bash
npm install --no-fund --no-audit
npm run seed   # นำเข้าข้อมูลจาก CSV ที่ฝังอยู่ใน index.html
npm start      # เปิดเซิร์ฟเวอร์ที่ http://localhost:8080
```

## ฟีเจอร์
- แดชบอร์ด: ตัวชี้วัด, แบ่งตามการชำระเงิน, เช็คอินล่าสุด
- ห้องพัก: สถานะ ว่าง/ไม่ว่าง/จอง/ทำความสะอาด + ตั้งสถานะทำความสะอาด
- การจอง: เพิ่ม/ลบ บันทึกลงฐานข้อมูล (หรือ LocalStorage เมื่อ API ใช้ไม่ได้)
- รายงาน: เลือกวันที่, ดูเช็คอิน/เช็คเอาต์, เพิ่มรายจ่าย, รวมยอด
- ส่งออก CSV: ผู้เข้าพัก, การจอง, รายจ่าย (ทั้งผ่านปุ่มในหน้าเว็บ และ API)

## API หลัก
- GET `/api/rooms`
- GET `/api/stays`
- GET `/api/bookings`
- POST `/api/bookings`
- DELETE `/api/bookings/:id`
- GET `/api/expenses?date_iso=YYYY-MM-DD` (ไม่ส่งพารามิเตอร์ = ทั้งหมด)
- POST `/api/expenses`
- GET `/api/cleaning/:dateIso`
- POST `/api/cleaning` (body: `{ date_iso, room_id, active }`)
- Export CSV: `/api/export/stays.csv`, `/api/export/bookings.csv`, `/api/export/expenses.csv?date_iso=...`

## ใช้งานบน Android (Termux)
```bash
pkg update -y && pkg upgrade -y
pkg install -y git nodejs tmux
termux-setup-storage

cd ~
git clone <YOUR_REPO_URL> viphat
cd viphat
npm install --no-fund --no-audit
npm run seed
npm start
# เปิด http://127.0.0.1:8080
```

## หมายเหตุ
- หาก backend ใช้ไม่ได้ Frontend จะ fallback ไปที่ CSV/LocalStorage อัตโนมัติ
- ข้อมูลตัวอย่างฝังอยู่ในตัวแปร `csvData` ภายใน `index.html`
