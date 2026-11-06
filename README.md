# 🌸 Zahra Shop - Invoice & Point of Sales System

Aplikasi manajemen toko (POS) berbasis web yang modern, responsif, dan dilengkapi fitur *real-time synchronization*. Dibangun untuk memudahkan pengelolaan invoice, stok barang, pelanggan, keuangan, hingga pencatatan aktivitas karyawan.

## ✨ Fitur Utama

- 🛒 **Manajemen Invoice & POS**: Dukungan pembayaran Cash, QRIS dinamis (DANA), Split Payment, dan Hutang/Tempo.
- 📦 **Manajemen Produk & Stok**: Dukungan produk fisik dan digital (pulsa, token, dll) dengan sinkronisasi stok real-time.
- 📊 **Laporan Bisnis**: Analisis omzet, laba kotor, piutang, dan produk terlaris dengan ekspor ke PDF dan CSV.
- 👥 **Manajemen Pelanggan**: Pencatatan pelanggan, riwayat transaksi, dan fitur *Top 5 Customers*.
- 💸 **Pencatatan Pengeluaran**: Manajemen biaya operasional dengan filter tanggal dan grafik distribusi.
- 🔒 **Multi-Role Access**: Pemisahan hak akses antara **Owner** dan **Admin** (dilindungi oleh *Row Level Security* Supabase).
- 📝 **Activity Logs**: Pencatatan otomatis setiap aktivitas (tambah/edit/hapus) untuk keperluan audit.
- 🔔 **Realtime Notifikasi**: Pemberitahuan stok menipis dan tagihan jatuh tempo secara *live*.
- 🔗 **Public Invoice**: Pelanggan dapat melihat invoice melalui link unik tanpa harus login.
- 💾 **Auto Backup**: Backup database harian otomatis menggunakan GitHub Actions.

## 🛠️ Teknologi yang Digunakan

- **Frontend**: [React.js](https://reactjs.org/) (Vite) + [React Router DOM](https://reactrouter.com/)
- **Styling**: Pure CSS (Glassmorphism Design) + [Framer Motion](https://www.framer.com/motion/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security)
- **State Management**: React Context API
- **Charts**: [Recharts](https://recharts.org/)
- **PDF & Excel**: html2pdf.js, xlsx
- **Deployment**: GitHub Pages
- **Backup**: GitHub Actions (pg_dump)

## 🚀 Cara Menjalankan di Lokal

### Prasyarat
- Node.js versi 18 atau lebih baru.
- Akun Supabase dan project yang sudah disiapkan.

### 1. Clone Repository
```bash
git clone https://github.com/[USERNAME_ANDA]/invoice-app.git
cd invoice-app
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Setup Environment Variables
Buat file `.env` di root folder, lalu isi dengan kredensial Supabase Anda:
```env
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON_KEY_ANDA]
```

### 4. Jalankan Development Server
```bash
npm run dev
```
Buka `http://localhost:5173` di browser.

## 🗄️ Setup Database (Supabase)

Aplikasi ini membutuhkan beberapa konfigurasi di Supabase:

1. Jalankan SQL script untuk membuat tabel (`products`, `invoices`, `customers`, `expenses`, `stock_movements`, `invoice_payments`, `activity_logs`, `profiles`, `backup_logs`).
2. Aktifkan **Row Level Security (RLS)** untuk membatasi akses antara Owner dan Admin.
3. Aktifkan fitur **Realtime** pada tabel: `products`, `invoices`, `customers`, `stock_movements`, `expenses`, `activity_logs`, dan `invoice_payments`.
4. Buat RPC functions: `finalize_invoice`, `delete_invoice_and_restore_stock`, `record_invoice_payment`, `get_public_invoice`, `get_store_invoice_profile`.
5. Buat Storage Bucket `logos` (public) untuk logo bisnis dan `backups` (private) untuk file backup.

## 📦 Deployment

Aplikasi ini di-deploy secara otomatis ke **GitHub Pages** setiap kali ada `push` ke branch `main`. Konfigurasi workflow dapat dilihat di `.github/workflows/deploy.yml`.

### Setup Secrets di GitHub
Buka **Settings → Secrets and variables → Actions**, lalu tambahkan:
- `VITE_SUPABASE_URL` → URL project Supabase Anda
- `VITE_SUPABASE_ANON_KEY` → Anon Key Supabase Anda
- `SUPABASE_DB_URL` → Connection string PostgreSQL (untuk backup otomatis)

## 💾 Backup Database

Sistem ini menggunakan **GitHub Actions** untuk melakukan backup database harian secara otomatis pada pukul 07:00 WIB. File backup akan disimpan sebagai *artifact* di tab Actions selama 90 hari. Konfigurasi dapat dilihat di `.github/workflows/backup.yml`.

## 📁 Struktur Folder

```
invoice-app/
├── .github/
│   └── workflows/
│       ├── deploy.yml         # Workflow deploy ke GitHub Pages
│       └── backup.yml         # Workflow backup database otomatis
├── public/                     # Asset statis (logo, favicon)
├── src/
│   ├── components/             # Komponen reusable (Layout, Modal, Select, dll)
│   ├── context/                # AuthContext & UIContext
│   ├── lib/                    # Helper functions (format, logger, qris)
│   ├── pages/                  # Halaman aplikasi
│   │   ├── Dashboard.jsx
│   │   ├── Invoices.jsx
│   │   ├── InvoiceForm.jsx
│   │   ├── InvoiceDetail.jsx
│   │   ├── Products.jsx
│   │   ├── Customers.jsx
│   │   ├── CustomerDetail.jsx
│   │   ├── Expenses.jsx
│   │   ├── Reports.jsx
│   │   ├── StockOpname.jsx
│   │   ├── Team.jsx
│   │   ├── ActivityLog.jsx
│   │   ├── Settings.jsx
│   │   ├── PublicInvoice.jsx
│   │   └── BackupRestore.jsx
│   ├── App.jsx                 # Router utama
│   ├── main.jsx                # Entry point
│   ├── styles.css              # Styling global
│   └── supabaseClient.js       # Konfigurasi Supabase
├── .env                        # Environment variables (JANGAN di-commit!)
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

## 🔐 Keamanan

- Semua kredensial (Supabase URL, Anon Key, DB URL) disimpan sebagai **GitHub Secrets** dan file `.env`, **tidak pernah** di-commit ke repository.
- Menggunakan **Row Level Security** di Supabase sehingga Admin tidak bisa mengakses data/menu khusus Owner.
- Setiap perubahan data penting (produk, invoice, pengeluaran, pelanggan) dicatat di tabel `activity_logs`.

## 🤝 Kontribusi

Kontribusi selalu diterima! Silakan buat *fork* repository ini, buat branch baru, lalu ajukan *pull request*.

## 📄 Lisensi

Proyek ini bersifat **private** untuk keperluan bisnis internal Zahra Shop. Tidak untuk didistribusikan ulang tanpa izin.

---

Dibuat dengan ❤️ untuk memajukan UMKM Indonesia.
