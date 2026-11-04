// Cari kode ini:
{profile?.role !== 'kasir' && (
  <Button variant="danger" onClick={handleDelete} disabled={isUpdating}><FaTrash /> Hapus</Button>
)}

// GANTI MENJADI:
{profile?.role === 'owner' && (
  <Button variant="danger" onClick={handleDelete} disabled={isUpdating}><FaTrash /> Hapus</Button>
)}