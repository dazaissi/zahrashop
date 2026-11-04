import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null)

  useEffect(() => {
    let isMounted = true
    const html5QrCode = new Html5Qrcode("reader")
    scannerRef.current = html5QrCode

    const startScanner = async () => {
      try {
        // Jeda 500ms agar elemen <div id="reader"> benar-benar siap di iOS
        await new Promise(resolve => setTimeout(resolve, 500))
        if (!isMounted) return

        await html5QrCode.start(
          { facingMode: "environment" }, // Paksa kamera belakang
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            // Hapus aspectRatio untuk mencegah layar hitam/gepeng di iOS
          },
          (decodedText) => {
            // Mainkan suara beep
            const beep = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg')
            beep.play().catch(() => {})
            onScan(decodedText)
          },
          () => {} // Abaikan error frame yang tidak terbaca
        )
      } catch (err) {
        console.error("Gagal membuka kamera: ", err)
        if (isMounted) {
          alert("Kamera gagal dibuka. Pastikan Anda sudah memberi izin kamera di pengaturan browser Safari/Chrome HP Anda.")
          onClose()
        }
      }
    }

    startScanner()

    // Fungsi pembersihan saat kamera ditutup
    return () => {
      isMounted = false
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.log("Stop error:", err))
      }
    }
  }, []) // <-- Biarkan array kosong agar tidak memicu re-render berulang

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'white', padding: 20, borderRadius: 12, width: '90%', maxWidth: 400 }}>
        <h3 style={{ marginTop: 0, textAlign: 'center', color: '#1f2937' }}>Scan Barcode Produk</h3>
        
        {/* Area kamera */}
        <div id="reader" style={{ width: '100%', borderRadius: 8, overflow: 'hidden', background: '#000' }}></div>
        
        <button onClick={onClose} className="btn-secondary" style={{ width: '100%', marginTop: 16, padding: '12px', fontSize: 16 }}>
          Tutup Kamera
        </button>
      </div>
    </div>
  )
}