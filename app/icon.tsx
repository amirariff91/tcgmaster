import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: '7px',
          border: '1.5px solid #f97316',
          boxShadow: '0 0 10px rgba(249, 115, 22, 0.5)',
        }}
      >
        <div
          style={{
            color: '#f97316',
            fontWeight: 900,
            fontSize: 18,
            fontStyle: 'italic',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-1.5px',
            transform: 'translateX(1px)',
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
