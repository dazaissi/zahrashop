import { useMemo } from 'react'
import Particles, { ParticlesProvider } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'

export default function StarBackground() {
  const particlesInit = useMemo(() => async (engine) => {
    await loadSlim(engine)
  }, [])

  return (
    <ParticlesProvider init={particlesInit}>
      <Particles
        id="tsparticles"
        options={{
          fullScreen: { enable: false },
          background: { color: { value: 'transparent' } },
          fpsLimit: 120,
          interactivity: {
            events: {
              onHover: {
                enable: true,
                mode: ['grab', 'bubble'], // Garis tertarik + bintang membesar saat disentuh mouse
              },
              onClick: {
                enable: true,
                mode: 'push',
              },
            },
            modes: {
              grab: { distance: 250, links: { opacity: 0.8 } },
              bubble: { distance: 200, size: 4, duration: 2, opacity: 0.8 },
              push: { quantity: 4 },
            },
          },
          particles: {
            paint: {
              // Kombinasi warna Pink, Ungu Nebula, dan Putih Bintang
              color: { value: ['#ec4899', '#8b5cf6', '#f472b6', '#ffffff'] },
            },
            links: {
              color: '#d946ef', // Garis rasi bintang warna ungu-pink
              distance: 160,
              enable: true,
              opacity: 0.3,
              width: 1.2,
            },
            move: {
              direction: 'none',
              enable: true,
              outModes: { default: 'bounce' },
              random: true,
              speed: 0.8,
              straight: false,
            },
            number: { 
              density: { enable: true, area: 800 }, 
              value: 70 // Sedikit lebih banyak bintang
            },
            opacity: { 
              value: { min: 0.1, max: 0.6 },
              animation: {
                enable: true,
                speed: 1.5,
                sync: false // Bintang berkedip bergantian secara acak (Twinkle effect)
              }
            },
            shape: { type: 'circle' },
            size: { 
              value: { min: 0.5, max: 2.5 },
              animation: {
                enable: true,
                speed: 2,
                sync: false
              }
            },
          },
          detectRetina: true,
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
    </ParticlesProvider>
  )
}