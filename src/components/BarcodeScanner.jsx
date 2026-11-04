import { useEffect } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

export default function BarcodeScanner({ onScan, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', {
      qrbox: { width: 250, height: 250 },
      fps: 10,
      supportedScanTypes: [0, 1, 2] // 0: QR, 1: Barcode, 2: 2D Barcode
    }, false)

    function onScanSuccess(decodedText) {
      // Mainkan suara beep (opsional)
      const beep = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg')
      beep.play().catch(() => {}) // Abaikan jika browser memblokir suara

      onScan(decodedText) // Kirim hasil scan ke form invoice
    }

    scanner.render(onScanSuccess, () => {
      // Abaikan error pembacaan frame agar kamera terus jalan
    })

    return () => {
      scanner.clear().catch(error => console.error("Gagal clear scanner", error))
    }
  }, [onScan])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{ background: 'white', padding: 20, borderRadius: 12, width: '90%', maxWidth: 400 }}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>Scan Barcode Produk</h3>
        <div id="reader" style={{ width: '100%', borderRadius: 8, overflow: 'hidden' }}></div>
        <button onClick={onClose} className="btn-secondary" style={{ width: '100%', marginTop: 16 }}>
          Tutup Kamera
        </button>
      </div>
    </div>
  )
}
