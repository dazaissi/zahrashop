import { useMemo } from 'react'

export default function StarBackground() {
  // Membuat 80 bintang acak dengan posisi dan ukuran berbeda
  const stars = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1, // Ukuran 1px - 3px
      delay: Math.random() * 5, // Delay kedip acak
      duration: Math.random() * 3 + 2 // Durasi kedip 2s - 5s
    }))
  }, [])

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100vw', 
      height: '100vh', 
      zIndex: -1, // Berada di paling belakang
      pointerEvents: 'none', 
      overflow: 'hidden' 
    }}>
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        .star-dot {
          position: absolute;
          background: #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 6px 1px rgba(236, 72, 153, 0.6); /* Efek glow pink */
          animation: twinkle var(--duration) ease-in-out infinite;
          animation-delay: var(--delay);
        }
      `}</style>
      
      {stars.map(star => (
        <div
          key={star.id}
          className="star-dot"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            '--duration': `${star.duration}s`,
            '--delay': `${star.delay}s`,
          }}
        />
      ))}
    </div>
  )
}