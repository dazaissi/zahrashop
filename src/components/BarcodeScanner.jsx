import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader")
    scannerRef.current = html5QrCode

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      // Kunci ke kamera belakang (environment)
      facingMode: "environment" 
    }

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            // Mainkan suara beep
            const beep = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg')
            beep.play().catch(() => {})
            onScan(decodedText)
          },
          () => {}
        )
      } catch (err) {
        console.error("Gagal membuka kamera: ", err)
        alert("Gagal membuka kamera. Pastikan Anda memberi izin kamera di browser.")
        onClose()
      }
    }

    startScanner()

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [onScan, onClose])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column',
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