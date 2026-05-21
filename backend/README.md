# Goal Dashboard Backend

Backend API untuk aplikasi Goal Dashboard, dibangun dengan **Express.js** + **Neon PostgreSQL**, di-deploy ke **Vercel**.

---

## Struktur Project

```
goal-dashboard-backend/
├── index.js              # Entry point Express
├── vercel.json           # Konfigurasi Vercel
├── package.json
├── .env.example          # Template environment variables
├── lib/
│   ├── db.js             # Koneksi ke Neon
│   └── db-init.js        # Script buat tabel (jalankan sekali)
├── middleware/
│   └── auth.js           # JWT middleware
└── api/
    ├── auth.js           # POST /api/auth/login, /register
    ├── goals.js          # GET/POST/PUT/DELETE /api/goals
    ├── milestones.js     # PATCH /api/milestones/:id/done
    └── export.js         # GET /api/export?format=json|csv
```

---

## Langkah Setup

### 1. Clone & Install

```bash
git clone <repo-anda>
cd goal-dashboard-backend
npm install
```

### 2. Setup Neon Database

1. Buka [neon.tech](https://neon.tech) → buat akun → buat project baru
2. Di dashboard Neon, copy **Connection String** (format: `postgresql://...`)
3. Buat file `.env` dari template:

```bash
cp .env.example .env
```

4. Isi `DATABASE_URL` dengan Connection String dari Neon

### 3. Inisialisasi Tabel

Jalankan sekali untuk membuat semua tabel di database:

```bash
npm run db:init
```

Output yang diharapkan:
```
🔧 Initializing database...
✅ Table: users
✅ Table: sessions
✅ Table: goals
✅ Table: milestones
✅ Table: reminders
🎉 Database initialized successfully!
```

### 4. Jalankan Lokal

```bash
npm run dev
```

Server berjalan di `http://localhost:3000`

---

## Deploy ke Vercel

### Cara 1: Via Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Set environment variables di Vercel
vercel env add DATABASE_URL
vercel env add JWT_SECRET

# Deploy ulang dengan env vars baru
vercel --prod
```

### Cara 2: Via GitHub (Auto-deploy)

1. Push project ke GitHub
2. Buka [vercel.com](https://vercel.com) → New Project → Import repo GitHub Anda
3. Di bagian **Environment Variables**, tambahkan:
   - `DATABASE_URL` = Connection String dari Neon
   - `JWT_SECRET` = string random panjang
4. Klik **Deploy**

---

## API Endpoints

### Auth

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/register` | Daftar akun baru |
| POST | `/api/auth/login` | Login → dapat token |

**Login request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Login response:**
```json
{
  "token": "eyJhbGci...",
  "user": { "id": "...", "email": "..." }
}
```

> Simpan token ini, kirim di setiap request berikutnya sebagai:
> `Authorization: Bearer <token>`

---

### Goals

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/goals` | Ambil semua goals (dashboard) |
| GET | `/api/goals/:id` | Detail goal + milestones |
| POST | `/api/goals` | Buat goal baru + milestones |
| PUT | `/api/goals/:id` | Update goal |
| DELETE | `/api/goals/:id` | Hapus goal |

**Buat goal baru:**
```json
{
  "title": "Belajar TypeScript",
  "description": "Kuasai TypeScript dalam 3 bulan",
  "deadline": "2024-12-31",
  "milestones": [
    { "title": "Selesaikan dokumentasi resmi" },
    { "title": "Buat project kecil" },
    { "title": "Kontribusi ke open source" }
  ]
}
```

---

### Milestones

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/milestones` | Tambah milestone |
| PATCH | `/api/milestones/:id/done` | Centang/uncentang milestone |
| DELETE | `/api/milestones/:id` | Hapus milestone |

**Centang milestone (otomatis hitung progress):**
```json
{ "is_done": true }
```

**Response:**
```json
{
  "milestone": { "id": "...", "is_done": true },
  "progress": 66.67,
  "goal": { "id": "...", "progress": 66.67 }
}
```

---

### Export Laporan

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/export` | Export JSON (default) |
| GET | `/api/export?format=csv` | Export CSV |

---

## Tips Keamanan Sebelum Production

- [ ] Ganti `JWT_SECRET` dengan string random minimal 32 karakter
- [ ] Aktifkan SSL di Neon (sudah default)
- [ ] Tambahkan rate limiting: `npm install express-rate-limit`
- [ ] Validasi input dengan: `npm install joi` atau `zod`
