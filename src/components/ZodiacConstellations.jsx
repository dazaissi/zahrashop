import React from 'react';

export default function ZodiacConstellations() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 1, // Sedikit di atas debu bintang, tapi di bawah konten
      pointerEvents: 'none',
      overflow: 'hidden'
    }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* RASI BINTANG ARIES */}
        <g transform="translate(10%, 15%) scale(1.5)" className="constellation">
          <polyline points="0,50 30,20 50,30 80,10" fill="none" stroke="rgba(236, 72, 153, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="0" cy="50" r="3" className="zodiac-star" />
          <circle cx="30" cy="20" r="4" className="zodiac-star" />
          <circle cx="50" cy="30" r="2.5" className="zodiac-star" />
          <circle cx="80" cy="10" r="3.5" className="zodiac-star" />
        </g>

        {/* RASI BINTANG PISCES */}
        <g transform="translate(70%, 40%) scale(1.5)" className="constellation">
          <polyline points="0,0 20,20 40,10 60,30" fill="none" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="0" cy="0" r="3" className="zodiac-star" />
          <circle cx="20" cy="20" r="3.5" className="zodiac-star" />
          <circle cx="40" cy="10" r="2.5" className="zodiac-star" />
          <circle cx="60" cy="30" r="4" className="zodiac-star" />
          
          <path d="M 60,30 Q 80,60 40,100" fill="none" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="1" strokeDasharray="2 4" />
          
          <polyline points="40,100 10,120 -10,100" fill="none" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="40" cy="100" r="3.5" className="zodiac-star" />
          <circle cx="10" cy="120" r="3" className="zodiac-star" />
          <circle cx="-10" cy="100" r="2.5" className="zodiac-star" />
        </g>

        {/* RASI BINTANG VIRGO */}
        <g transform="translate(15%, 65%) scale(1.5)" className="constellation">
          <polyline points="50,0 30,40 50,80 80,100" fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
          <polyline points="30,40 0,50" fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
          <polyline points="50,80 20,100" fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
          
          <circle cx="50" cy="0" r="4" className="zodiac-star" />
          <circle cx="30" cy="40" r="3" className="zodiac-star" />
          <circle cx="50" cy="80" r="2.5" className="zodiac-star" />
          <circle cx="80" cy="100" r="3" className="zodiac-star" />
          <circle cx="0" cy="50" r="2" className="zodiac-star" />
          <circle cx="20" cy="100" r="2.5" className="zodiac-star" />
        </g>
      </svg>
    </div>
  );
}