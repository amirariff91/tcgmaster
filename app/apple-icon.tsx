import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #030712 100%)',
          borderRadius: '40px',
          border: '6px solid #f97316',
          boxShadow: '0 0 30px rgba(249, 115, 22, 0.6)',
        }}
      >
        <div
          style={{
            color: '#f97316',
            fontWeight: 900,
            fontSize: 104,
            fontStyle: 'italic',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-8px',
            transform: 'translateX(4px)',
            display: 'flex',
          }}
        >
          TM
        </div>
      </div>
    ),
    { ...size }
  );
}
