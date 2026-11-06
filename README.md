# Zahra Shop — Invoice & Point of Sales System

Sistem manajemen toko berbasis web untuk pengelolaan invoice, stok, pelanggan, dan keuangan. Dibangun dengan React dan Supabase, mendukung sinkronisasi data real-time antar pengguna serta pemisahan hak akses antara Owner dan Admin.

## Fitur

| Modul | Deskripsi |
|---|---|
| Invoice & POS | Pembayaran Cash, QRIS dinamis, Split Payment, dan Hutang/Tempo |
| Produk & Stok | Dukungan produk fisik dan digital, dengan riwayat pergerakan stok |
| Laporan | Analisis omzet, laba kotor, piutang, produk terlaris; ekspor PDF dan CSV |
| Pelanggan | Database pelanggan, riwayat transaksi, dan ranking pelanggan teratas |
| Pengeluaran | Pencatatan biaya operasional dengan grafik dan filter periode |
| Multi-Role | Owner dan Admin dengan Row Level Security di database |
| Activity Log | Audit trail otomatis untuk setiap operasi CRUD |
| Realtime | Notifikasi stok menipis dan tagihan jatuh tempo secara live |
| Public Invoice | Link publik untuk pelanggan melihat invoice tanpa login |
| Backup | Backup database harian otomatis via GitHub Actions |

## Stack

- **Frontend** — React 18, Vite, React Router, Context API
- **Styling** — Vanilla CSS (glassmorphism), Framer Motion
- **Backend** — Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Library** — Recharts, html2pdf.js, xlsx
- **Deployment** — GitHub Pages, GitHub Actions
- **Backup** — pg_dump via GitHub Actions

## Menjalankan di Lokal

### Prasyarat
- Node.js 18+
- Akun Supabase beserta project yang sudah dikonfigurasi

### Instalasi

```bash
git clone https://github.com/[USERNAME]/invoice-app.git
cd invoice-app
npm install
```

Buat file `.env` di root project:

```env
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON_KEY]
```

Jalankan development server:

```bash
npm run dev
```

Aplikasi tersedia di `http://localhost:5173`.

## Konfigurasi Supabase

1. **Tabel** — `products`, `invoices`, `invoice_items`, `customers`, `expenses`, `stock_movements`, `invoice_payments`, `activity_logs`, `profiles`, `backup_logs`
2. **Row Level Security** — aktifkan pada seluruh tabel, dengan policy terpisah untuk Owner dan Admin
3. **Realtime** — aktifkan pada tabel `products`, `invoices`, `customers`, `stock_movements`, `expenses`, `activity_logs`, `invoice_payments`
4. **RPC Functions** — `finalize_invoice`, `delete_invoice_and_restore_stock`, `record_invoice_payment`, `get_public_invoice`, `get_store_invoice_profile`
5. **Storage Bucket** — `logos` (public) untuk aset branding, `backups` (private) untuk file backup

## Deployment

Aplikasi di-deploy otomatis ke GitHub Pages setiap kali ada push ke branch `main` melalui workflow `.github/workflows/deploy.yml`.

### GitHub Secrets yang Dibutuhkan

| Secret | Keterangan |
|---|---|
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase |
| `SUPABASE_DB_URL` | Connection string PostgreSQL (untuk backup) |

## Backup Database

Backup otomatis berjalan setiap hari pukul 07:00 WIB melalui `.github/workflows/backup.yml`. File `.sql` disimpan sebagai artifact di tab Actions dengan retensi 90 hari, dan dapat diunduh kapan saja.

## Struktur Proyek

```
invoice-app/
├── .github/workflows/       # Deploy & backup automation
├── public/                  # Aset statis
├── src/
│   ├── components/          # Komponen reusable (Layout, Modal, Select, dll)
│   ├── context/             # AuthContext, UIContext
│   ├── lib/                 # Helper (format, logger, qris)
│   ├── pages/               # 15 halaman utama
│   ├── App.jsx              # Router
│   ├── main.jsx             # Entry point
│   └── supabaseClient.js    # Konfigurasi Supabase
├── .env                     # Tidak di-commit
├── .gitignore
├── package.json
└── vite.config.js
```

## Keamanan

- Kredensial disimpan sebagai GitHub Secrets dan file `.env` lokal, tidak pernah di-commit ke repository
- Row Level Security mencegah Admin mengakses menu dan data khusus Owner
- Setiap perubahan data tercatat di tabel `activity_logs` untuk keperluan audit

## Alur Pengembangan

Perubahan pada branch `main` akan memicu deploy otomatis ke GitHub Pages dalam 1–2 menit.

```bash
git add .
git commit -m "[tipe]: [deskripsi]"
git push origin main
```

Pantau status deploy pada tab **Actions** di repository GitHub.

Untuk perubahan besar yang memerlukan review, gunakan alur branch:

```bash
git checkout -b feat/nama-fitur
# lakukan perubahan...
git add .
git commit -m "feat: nama fitur"
git push origin feat/nama-fitur
```

Lalu ajukan Pull Request ke `main`.

## Lisensi

Proyek ini bersifat privat untuk keperluan internal Zahra Shop. Dilarang mendistribusikan ulang tanpa izin tertulis.
