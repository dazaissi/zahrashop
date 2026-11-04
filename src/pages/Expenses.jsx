import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal } from '../lib/format'
import { FaEdit, FaTrash, FaSave } from 'react-icons/fa'
import Button from '../components/ui/Button'

export default function Expenses() {
  const { session } = useAuth()
  const { showConfirm, showToast } = useUI()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [id, setId] = useState(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => { if (session) fetchExpenses() }, [session])

  async function fetchExpenses() {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false })
    if (data) setExpenses(data)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setIsSubmitting(true)
    const payload = { description, amount: Number(amount), date, user_id: session.user.id }
    if (id) await supabase.from('expenses').update(payload).eq('id', id)
    else await supabase.from('expenses').insert([payload])
    resetForm(); fetchExpenses(); setIsSubmitting(false); showToast('Pengeluaran dicatat!', 'success')
  }

  async function handleDelete(idToDelete) {
    if (await showConfirm('Hapus Pengeluaran', 'Hapus catatan pengeluaran ini?')) {
      await supabase.from('expenses').delete().eq('id', idToDelete)
      showToast('Pengeluaran dihapus', 'success')
      fetchExpenses()
    }
  }

  function resetForm() { setId(null); setDescription(''); setAmount(''); setDate(new Date().toISOString().split('T')[0]) }

  return (
    <div>
      <h1>Pengeluaran Operasional</h1>
      <div className="card" style={{ marginBottom: 24, maxWidth: 600 }}>
        <h3>{id ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <input required placeholder="Keterangan (Misal: Bayar Listrik) *" value={description} onChange={e => setDescription(e.target.value)} />
          <input required type="number" placeholder="Nominal (Rp) *" value={amount} onChange={e => setAmount(e.target.value)} />
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" variant="solid" disabled={isSubmitting}><FaSave /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
            {id && <Button type="button" variant="secondary" onClick={resetForm}>Batal</Button>}
          </div>
        </form>
      </div>

      {loading ? <div className="skeleton" style={{ height: 200 }}></div> : (
        <table>
          <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Nominal</th><th>Aksi</th></tr></thead>
          <tbody>
            {expenses.map(ex => (
              <tr key={ex.id}>
                <td>{formatTanggal(ex.date)}</td>
                <td><strong>{ex.description}</strong></td>
                <td style={{ color: 'red', fontWeight: 'bold' }}>{formatRupiah(ex.amount)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="secondary" onClick={() => { setId(ex.id); setDescription(ex.description); setAmount(ex.amount); setDate(ex.date) }}><FaEdit /> Edit</Button>
                    <Button variant="danger" onClick={() => handleDelete(ex.id)}><FaTrash /> Hapus</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}