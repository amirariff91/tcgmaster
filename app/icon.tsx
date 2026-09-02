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
          background: 'transparent',
        }}
      >
        <div
          style={{
            color: '#f97316',
            fontWeight: 900,
            fontSize: 26,
            fontStyle: 'italic',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-2px',
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
