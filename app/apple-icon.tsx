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
          background: 'transparent',
        }}
      >
        <div
          style={{
            color: '#f97316',
            fontWeight: 900,
            fontSize: 148,
            fontStyle: 'italic',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-12px',
            transform: 'translateX(6px)',
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
