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
