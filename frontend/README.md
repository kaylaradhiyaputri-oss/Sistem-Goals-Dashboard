# GoalProgress Frontend

React app untuk Goal-Progress Dashboard. Dibangun dengan **Vite + React + Recharts**.

## Halaman

| Halaman | Route | Deskripsi |
|---|---|---|
| Landing Page | `/` | Halaman utama publik |
| Login | `/login` | Form login |
| Register | `/register` | Form daftar akun |
| Dashboard | `/dashboard` | App utama (butuh login) |

## Fitur Dashboard

- Stat cards: total goals, selesai, dalam progres, rata-rata progres
- Grafik progres mingguan (line chart)
- Pie chart status goals
- Daftar goals aktif dengan progress bar
- Buat goal baru + milestones sekaligus
- Klik goal → lihat & centang milestones → progress otomatis terupdate
- Export laporan CSV

## Setup

```bash
npm install
cp .env.example .env.local
# Isi VITE_API_URL dengan URL backend Vercel Anda
npm run dev
```

App berjalan di `http://localhost:5173`

## Deploy ke Vercel

```bash
npm i -g vercel
vercel

# Set env variable:
vercel env add VITE_API_URL
# isi: https://nama-backend-anda.vercel.app

vercel --prod
```

## Koneksi ke Backend

Semua request ke backend via `src/lib/api.js`. Ganti `VITE_API_URL` di `.env.local` sesuai URL backend Anda.
