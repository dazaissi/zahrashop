
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { formatRupiah, formatTanggal, formatNumberInput } from '../lib/format'
import {
  FaWhatsapp,
  FaTrash,
  FaPrint,
  FaShareAlt,
  FaCheckCircle,
  FaExclamationTriangle
} from 'react-icons/fa'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { logActivity } from '../lib/logger'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { showConfirm, showToast } = useUI()

  const [invoice, setInvoice] = useState(null)
  const [items, setItems] = useState([])
  const [payments, setPayments] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState(null)

  const isOwner = profile?.role?.toLowerCase() === 'owner'

  useEffect(() => {
    if (session?.user?.id && id) fetchInvoice()
  }, [session?.user?.id, id])

  async function fetchInvoice() {
    setLoading(true)

    try {
      const [
        { data: profileData, error: profileError },
        { data: invoiceData, error: invoiceError }
      ] = await Promise.all([
        supabase.rpc('get_store_invoice_profile'),
        supabase
          .from('invoices')
          .select('*, customers(*), invoice_items(*, products(name))')
          .eq('id', id)
          .single()
      ])

      if (profileError) throw profileError
      if (invoiceError) throw invoiceError
      if (!invoiceData) throw new Error('Invoice tidak ditemukan.')

      setProfile(profileData)
      setInvoice(invoiceData)
      setItems(invoiceData.invoice_items || [])

      const { data: paymentData, error: paymentError } = await supabase
        .from('invoice_payments')
        .select('*')
        .eq('invoice_id', id)
        .order('created_at', { ascending: false })

      if (paymentError) throw paymentError

      setPayments(paymentData || [])
    } catch (error) {
      console.error('Gagal memuat invoice:', error)
      showToast('Gagal memuat invoice: ' + error.message, 'error')
      navigate('/invoices')
    } finally {
      setLoading(false)
    }
  }

  function handleDownloadPdf() {
    if (!invoice) return

    const element = document.getElementById('invoice-paper')
    if (!element) return

    html2pdf()
      .set({
        margin: 0.5,
        filename: `Invoice-${invoice.invoice_number.replace(/\//g, '-')}.pdf`,
        html2canvas: {
          scale: 2,
          useCORS: true
        },
        jsPDF: {
          unit: 'in',
          format: 'a4',
          orientation: 'portrait'
        }
      })
      .from(element)
      .save()
  }

  function handleDownloadReceipt(payment) {
    if (!payment) return

    const element = document.getElementById('receipt-paper')
    if (!element) return

    html2pdf()
      .set({
        margin: 0.5,
        filename: `Kwitansi-${payment.id}.pdf`,
        html2canvas: {
          scale: 2,
          useCORS: true
        },
        jsPDF: {
          unit: 'in',
          format: 'a5',
          orientation: 'landscape'
        }
      })
      .from(element)
      .save()
  }

  function getPublicLink() {
    if (!invoice?.invoice_number || !invoice?.public_token) return null

    return `${window.location.origin}/public-invoice/${encodeURIComponent(invoice.invoice_number)}/${encodeURIComponent(invoice.public_token)}`
  }

  async function handleShareLink() {
    const publicUrl = getPublicLink()

    if (!publicUrl) {
      return showToast(
        'Token publik belum tersedia. Periksa kolom public_token pada tabel invoices.',
        'error'
      )
    }

    try {
      await navigator.clipboard.writeText(publicUrl)
      showToast('Link publik berhasil disalin!', 'success')
    } catch (error) {
      console.error('Gagal menyalin link:', error)
      showToast('Gagal menyalin link. Silakan salin secara manual.', 'error')
    }
  }

  function getWhatsAppLink() {
    if (!invoice?.customers?.phone) return '#'

    const publicUrl = getPublicLink()
    if (!publicUrl) return '#'

    let phone = invoice.customers.phone.replace(/\D/g, '')

    if (phone.startsWith('0')) {
      phone = '62' + phone.slice(1)
    }

    const message = `Halo *${invoice.customers.name || 'Pelanggan'}*,\n\nBerikut kami kirimkan Invoice *${invoice.invoice_number}* dengan total *${formatRupiah(invoice.total)}*.\n\nStatus: *${(invoice.status || '').toUpperCase()}*\n\nAnda dapat melihat rincian invoice secara online melalui link berikut:\n${publicUrl}\n\nTerima kasih.`

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  }

  async function handleSavePayment(e) {
    e.preventDefault()

    if (!session?.user?.id) {
      return showToast('Sesi login tidak ditemukan. Silakan login kembali.', 'error')
    }

    const remaining = Number(invoice.total) - Number(invoice.paid_amount || 0)
    const amount = Number(payAmount.replace(/\./g, ''))

    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      return showToast('Nominal tidak valid atau melebihi sisa tagihan!', 'error')
    }

    setIsUpdating(true)

    try {
      const { data, error } = await supabase.rpc('record_invoice_payment', {
        p_invoice_id: invoice.id,
        p_amount: amount,
        p_payment_method: 'transfer'
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error('Pembayaran gagal dicatat.')
      }

      try {
        await logActivity(
          session.user.id,
          'BAYAR',
          `Menerima ${formatRupiah(amount)} untuk invoice ${invoice.invoice_number}`
        )
      } catch (logError) {
        console.error('Gagal mencatat aktivitas:', logError)
      }

      setIsPayModalOpen(false)
      setPayAmount('')
      showToast('Pembayaran berhasil dicatat!', 'success')

      await fetchInvoice()
    } catch (error) {
      console.error('Gagal menyimpan pembayaran:', error)
      showToast('Gagal menyimpan pembayaran: ' + error.message, 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDelete() {
    if (!isOwner) {
      return showToast('Hanya Owner yang dapat menghapus invoice.', 'error')
    }

    const confirmed = await showConfirm(
      'Hapus Invoice',
      'Hapus invoice ini? Stok produk akan dikembalikan secara otomatis.'
    )

    if (!confirmed) return

    setIsUpdating(true)

    try {
      const { data, error } = await supabase.rpc(
        'delete_invoice_and_restore_stock',
        {
          p_invoice_id: invoice.id
        }
      )

      if (error) throw error
      if (!data?.success) throw new Error('Invoice gagal dihapus.')

      try {
        await logActivity(
          session.user.id,
          'HAPUS INVOICE',
          `Menghapus invoice ${invoice.invoice_number}`
        )
      } catch (logError) {
        console.error('Gagal mencatat aktivitas:', logError)
      }

      showToast('Invoice berhasil dihapus dan stok dikembalikan!', 'success')
      navigate('/invoices')
    } catch (error) {
      console.error('Gagal menghapus invoice:', error)
      showToast('Gagal menghapus invoice: ' + error.message, 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  if (loading) {
    return <div className="skeleton" style={{ height: 600, marginTop: 24 }} />
  }

  if (!invoice) return <p>Invoice tidak ditemukan.</p>

  const sisaTagihan = Math.max(
    0,
    Number(invoice.total || 0) - Number(invoice.paid_amount || 0)
  )

  const isPaid = invoice.status === 'paid'

  const statusColors = {
    draft: '#64748b',
    sent: '#3b82f6',
    partial: '#eab308',
    paid: '#10b981',
    overdue: '#ef4444'
  }

  const statusBgColors = {
    draft: '#f1f5f9',
    sent: '#eff6ff',
    partial: '#fefce8',
    paid: '#ecfdf5',
    overdue: '#fef2f2'
  }

  return (
    <div>
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Catat Pembayaran"
      >
        <p style={{
          color: 'var(--text-muted)',
          marginBottom: 16,
          textAlign: 'center'
        }}>
          Sisa Tagihan:
          <br />
          <strong style={{
            color: '#ef4444',
            fontSize: 24
          }}>
            {formatRupiah(sisaTagihan)}
          </strong>
        </p>

        <form onSubmit={handleSavePayment}>
          <input
            type="text"
            value={formatNumberInput(payAmount)}
            onChange={e => setPayAmount(
              e.target.value.replace(/\./g, '').replace(/\D/g, '')
            )}
            style={{
              width: '100%',
              fontSize: 24,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 24,
              padding: 16,
              borderRadius: 12,
              border: '2px solid var(--border-color)'
            }}
            placeholder="0"
            autoFocus
          />

          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (await showConfirm('Batal', 'Yakin ingin membatalkan pembayaran ini?')) {
                  setIsPayModalOpen(false)
                }
              }}
              style={{
                flex: 1,
                justifyContent: 'center',
                padding: 14
              }}
            >
              Batal
            </Button>

            <Button
              type="submit"
              variant="success"
              disabled={isUpdating}
              style={{
                flex: 1,
                justifyContent: 'center',
                padding: 14
              }}
            >
              {isUpdating ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title="Kwitansi Pembayaran"
        maxWidth={700}
      >
        <div style={{
          maxHeight: '70vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 10
        }}>
          <div
            id="receipt-paper"
            style={{
              padding: '30px 20px',
              borderRadius: 8,
              background: 'white',
              color: '#1f2937',
              border: '1px solid #e5e7eb'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '2px solid #111827',
              paddingBottom: 16,
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24 }}>
                  {profile?.business_name || 'Bisnis Saya'}
                </h2>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: 12,
                  color: '#6b7280'
                }}>
                  {profile?.address}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <h3 style={{
                  margin: 0,
                  color: 'var(--primary)',
                  fontSize: 20
                }}>
                  KWITANSI
                </h3>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: 12,
                  color: '#6b7280'
                }}>
                  No: KW-{String(selectedReceipt?.id || '').padStart(5, '0')}
                </p>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              gap: '12px 16px',
              marginBottom: 30,
              fontSize: 14
            }}>
              <div style={{ color: '#6b7280' }}>Telah Diterima Dari:</div>
              <div style={{ fontWeight: 700 }}>
                {invoice.customers?.name || 'Umum'}
              </div>

              <div style={{ color: '#6b7280' }}>Uang Sejumlah:</div>
              <div style={{
                fontWeight: 800,
                fontSize: 20,
                color: 'var(--primary)'
              }}>
                {formatRupiah(selectedReceipt?.amount)}
              </div>

              <div style={{ color: '#6b7280' }}>Untuk Pembayaran:</div>
              <div>Invoice <strong>{invoice.invoice_number}</strong></div>

              <div style={{ color: '#6b7280' }}>Tanggal:</div>
              <div>
                {selectedReceipt?.payment_date
                  ? new Date(selectedReceipt.payment_date).toLocaleString('id-ID')
                  : '-'}
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 30,
              flexWrap: 'wrap',
              gap: 20
            }}>
              <div style={{ textAlign: 'center', width: 150 }}>
                <p style={{ marginBottom: 40, fontSize: 13 }}>Penerima,</p>
                <p style={{
                  borderTop: '1px solid #111827',
                  paddingTop: 8,
                  fontSize: 13
                }}>
                  ({profile?.business_name || 'Bisnis Saya'})
                </p>
              </div>

              <div style={{ textAlign: 'center', width: 150 }}>
                <p style={{ marginBottom: 40, fontSize: 13 }}>Penyetor,</p>
                <p style={{
                  borderTop: '1px solid #111827',
                  paddingTop: 8,
                  fontSize: 13
                }}>
                  ({invoice.customers?.name || 'Pelanggan'})
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <Button
            variant="secondary"
            onClick={() => setSelectedReceipt(null)}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Tutup
          </Button>
          <Button
            variant="solid"
            onClick={() => handleDownloadReceipt(selectedReceipt)}
            style={{ flex: 2, justifyContent: 'center' }}
          >
            <FaPrint /> Download PDF
          </Button>
        </div>
      </Modal>

      <div className="detail-header">
        <div>
          <Link to="/invoices" className="btn-back">
            &larr; Kembali ke Daftar
          </Link>
          <h1 style={{ margin: 0, fontSize: 24 }}>Detail Invoice</h1>
        </div>

        <div className="action-buttons-group">
          {isOwner && (
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={isUpdating}
              className="btn-mobile-full"
            >
              <FaTrash /> Hapus
            </Button>
          )}

          <button
            onClick={handleShareLink}
            className="btn-action btn-action-primary btn-mobile-full"
          >
            <FaShareAlt size={16} /> Share Link
          </button>

          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-action btn-action-green btn-mobile-full"
            onClick={e => {
              if (!invoice.customers?.phone || !getPublicLink()) {
                e.preventDefault()
                showToast(
                  'Nomor WhatsApp pelanggan atau token publik belum tersedia.',
                  'error'
                )
              }
            }}
          >
            <FaWhatsapp size={16} /> WhatsApp
          </a>

          <Button
            variant="primary"
            onClick={handleDownloadPdf}
            className="btn-mobile-full"
          >
            <FaPrint /> Cetak PDF
          </Button>
        </div>
      </div>

      {!isPaid && invoice.status !== 'draft' && (
        <div className="alert-warning">
          <div className="alert-warning-text">
            <h4 style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <FaExclamationTriangle /> Tagihan Belum Lunas
            </h4>
            <p>
              Total: <strong>{formatRupiah(invoice.total)}</strong>
              <br className="mobile-only" />
              Dibayar: <strong>{formatRupiah(invoice.paid_amount)}</strong>
              <br className="mobile-only" />
              Sisa: <strong style={{ fontSize: 18 }}>{formatRupiah(sisaTagihan)}</strong>
            </p>
          </div>

          <div className="alert-warning-actions">
            <Button
              variant="primary"
              onClick={() => {
                setPayAmount(String(sisaTagihan))
                setIsPayModalOpen(true)
              }}
              style={{
                width: '100%',
                justifyContent: 'center'
              }}
            >
              Catat Pembayaran
            </Button>
          </div>
        </div>
      )}

      {invoice.status === 'draft' && (
        <div className="alert-warning">
          <div className="alert-warning-text">
            <h4>Invoice masih berstatus Draft</h4>
            <p>
              Invoice ini belum berhasil difinalisasi. Periksa stok dan data
              barang sebelum memprosesnya kembali.
            </p>
          </div>
        </div>
      )}

      <div id="invoice-paper" className="invoice-paper-container">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: 20,
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 8
            }}>
              {profile?.logo_url && (
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  style={{
                    height: 50,
                    objectFit: 'contain',
                    mixBlendMode: 'multiply'
                  }}
                />
              )}
              <h2 style={{
                margin: 0,
                color: 'var(--primary)',
                fontSize: 28
              }}>
                INVOICE
              </h2>
            </div>

            <p style={{ margin: 0, fontWeight: 'bold' }}>
              {profile?.business_name || 'Bisnis Saya'}
            </p>

            <p style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: 'var(--text-muted)',
              maxWidth: 250
            }}>
              {profile?.address}
              <br />
              {profile?.phone && `Telp: ${profile.phone} | `}
              {profile?.email}
            </p>

            <p style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: 'var(--text-muted)'
            }}>
              No. Inv: {invoice.invoice_number}
            </p>
          </div>

          <div style={{
            textAlign: 'right',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8
          }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 13 }}>
                <strong>Tanggal:</strong> {formatTanggal(invoice.issue_date)}
              </p>

              {invoice.due_date && (
                <p style={{
                  margin: '0 0 4px',
                  color: '#ef4444',
                  fontSize: 13
                }}>
                  <strong>Jatuh Tempo:</strong> {formatTanggal(invoice.due_date)}
                  {invoice.due_time && ` (${invoice.due_time})`}
                </p>
              )}
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: statusBgColors[invoice.status] || '#f1f5f9',
              color: statusColors[invoice.status] || '#64748b',
              padding: '8px 16px',
              borderRadius: 20,
              fontWeight: 800,
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              border: `1px solid ${statusColors[invoice.status] || '#64748b'}40`
            }}>
              {isPaid && <FaCheckCircle size={16} />}
              {invoice.status === 'partial' && <FaExclamationTriangle size={16} />}
              {invoice.status}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 32,
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            <p style={{
              margin: '0 0 8px',
              color: 'var(--text-muted)',
              fontSize: 12,
              textTransform: 'uppercase',
              fontWeight: 'bold'
            }}>
              Ditagihkan Kepada:
            </p>

            <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>
              {invoice.customers?.name || 'Pelanggan Umum'}
            </h3>

            <p style={{
              margin: 0,
              color: 'var(--text-muted)',
              fontSize: 14
            }}>
              {invoice.customers?.phone}
            </p>

            <p style={{
              margin: 0,
              color: 'var(--text-muted)',
              fontSize: 14,
              maxWidth: 200
            }}>
              {invoice.customers?.address}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <p style={{
              margin: '0 0 8px',
              color: 'var(--text-muted)',
              fontSize: 12,
              textTransform: 'uppercase',
              fontWeight: 'bold'
            }}>
              Metode Pembayaran:
            </p>

            <h3 style={{
              margin: '0 0 4px',
              textTransform: 'uppercase',
              fontSize: 18
            }}>
              {invoice.payment_method}
            </h3>

            {invoice.payment_method === 'hutang' && (
              <p style={{
                margin: 0,
                color: '#ef4444',
                fontSize: 13,
                fontWeight: 'bold'
              }}>
                Sisa: {formatRupiah(sisaTagihan)}
              </p>
            )}
          </div>
        </div>

        <div style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          marginBottom: 32
        }}>
          <table style={{
            width: '100%',
            minWidth: 500,
            borderCollapse: 'collapse',
            boxShadow: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: 8
          }}>
            <thead>
              <tr style={{ background: 'var(--bg-color)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>
                  Deskripsi
                </th>
                <th width="80" style={{ textAlign: 'center', padding: '12px 16px' }}>
                  Qty
                </th>
                <th width="130" style={{ textAlign: 'right', padding: '12px 16px' }}>
                  Harga
                </th>
                <th width="130" style={{ textAlign: 'right', padding: '12px 16px' }}>
                  Subtotal
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.id || index}
                  style={{ borderBottom: '1px solid var(--border-color)' }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <strong style={{
                      display: 'block',
                      fontSize: 14
                    }}>
                      {item.description}
                    </strong>

                    {item.products && (
                      <span style={{
                        fontSize: 12,
                        color: 'var(--text-muted)'
                      }}>
                        {item.products.name}
                      </span>
                    )}
                  </td>

                  <td style={{
                    textAlign: 'center',
                    padding: '12px 16px'
                  }}>
                    {item.quantity}
                  </td>

                  <td style={{
                    textAlign: 'right',
                    padding: '12px 16px'
                  }}>
                    {formatRupiah(item.unit_price)}
                  </td>

                  <td style={{
                    textAlign: 'right',
                    padding: '12px 16px',
                    fontWeight: 'bold'
                  }}>
                    {formatRupiah(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 350 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
              <strong>{formatRupiah(invoice.subtotal)}</strong>
            </div>

            {Number(invoice.discount) > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--border-color)',
                color: '#ef4444'
              }}>
                <span>Diskon</span>
                <strong>-{formatRupiah(invoice.discount)}</strong>
              </div>
            )}

            {Number(invoice.tax_amount) > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Pajak ({invoice.tax_percent}%)
                </span>
                <strong>{formatRupiah(invoice.tax_amount)}</strong>
              </div>
            )}

            {Number(invoice.shipping) > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Ongkir</span>
                <strong>{formatRupiah(invoice.shipping)}</strong>
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '16px 0',
              fontSize: 22,
              color: 'var(--primary)',
              fontWeight: 800
            }}>
              <span>Total</span>
              <span>{formatRupiah(invoice.total)}</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#ecfdf5',
              color: '#10b981',
              borderRadius: 8,
              fontWeight: 'bold'
            }}>
              <span>Telah Dibayar</span>
              <span>{formatRupiah(invoice.paid_amount)}</span>
            </div>

            {!isPaid && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                marginTop: 8,
                background: '#fef2f2',
                color: '#ef4444',
                borderRadius: 8,
                fontWeight: 'bold'
              }}>
                <span>Sisa Tagihan</span>
                <span>{formatRupiah(sisaTagihan)}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{
          marginTop: 40,
          paddingTop: 20,
          borderTop: '1px dashed var(--border-color)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 24
        }}>
          <div>
            {invoice.notes && (
              <div>
                <p style={{
                  margin: '0 0 4px',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 'bold'
                }}>
                  Catatan:
                </p>
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5
                }}>
                  {invoice.notes}
                </p>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            {profile?.bank_info && (
              <div>
                <p style={{
                  margin: '0 0 4px',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 'bold'
                }}>
                  Info Transfer:
                </p>
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5
                }}>
                  {profile.bank_info}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {payments.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>
            Riwayat Pembayaran
          </h2>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}>
              <table style={{
                minWidth: 500,
                margin: 0,
                boxShadow: 'none',
                border: 'none'
              }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px' }}>Tanggal</th>
                    <th style={{ padding: '12px 16px' }}>Nominal</th>
                    <th style={{ padding: '12px 16px' }}>Metode</th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'center'
                    }}>
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map(payment => (
                    <tr key={payment.id}>
                      <td style={{
                        padding: '12px 16px',
                        fontSize: 13
                      }}>
                        {payment.payment_date
                          ? new Date(payment.payment_date).toLocaleString('id-ID')
                          : new Date(payment.created_at).toLocaleString('id-ID')}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ color: '#10b981' }}>
                          {formatRupiah(payment.amount)}
                        </strong>
                      </td>

                      <td style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        textTransform: 'uppercase'
                      }}>
                        {payment.payment_method}
                      </td>

                      <td style={{
                        padding: '12px 16px',
                        textAlign: 'center'
                      }}>
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedReceipt(payment)}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12
                          }}
                        >
                          <FaPrint /> Cetak Kwitansi
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
