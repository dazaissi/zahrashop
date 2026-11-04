export const formatRupiah = (angka) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(angka || 0)
}

export const formatTanggal = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export const formatNumberInput = (value) => {
  const num = value.replace(/\D/g, '') // Hapus semua karakter selain angka
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.') // Beri titik setiap 3 angka
}