import type { ReactElement, SVGProps } from 'react'

// Iconos SVG propios (trazo redondeado, estilo juguete).

export type IconName =
  | 'back'
  | 'hanger'
  | 'camera'
  | 'trophy'
  | 'runway'
  | 'closet'
  | 'shop'
  | 'heart'
  | 'sparkle'
  | 'volume'
  | 'mute'
  | 'body'
  | 'face'
  | 'hand'
  | 'foot'
  | 'save'
  | 'dice'
  | 'close'
  | 'check'
  | 'lock'
  | 'hair'
  | 'brush'
  | 'nail'
  | 'gear'
  | 'star'
  | 'smile'
  | 'wink'
  | 'pout'
  | 'grin'
  | 'laugh'
  | 'surprise'
  | 'download'
  | 'trash'
  | 'copy'
  | 'edit'
  | 'timer'
  | 'plane'
  | 'shirt'
  | 'pants'
  | 'dress'
  | 'jacket'
  | 'shoe'
  | 'bag'
  | 'gem'
  | 'glasses'
  | 'hat'
  | 'bow'
  | 'sun'
  | 'disco'
  | 'butterfly'
  | 'guitar'
  | 'sneaker'
  | 'flower'
  | 'snow'
  | 'sunset'
  | 'moon'
  | 'shell'
  | 'wand'
  | 'pose'
  | 'sticker'
  | 'frame'
  | 'play'
  | 'home'

const P: Record<IconName, ReactElement> = {
  back: <path d="M15 5l-7 7 7 7" />,
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  hanger: (
    <>
      <path d="M12 7a2 2 0 1 1 2-2c0 1-1 1.5-2 2.5V9" />
      <path d="M12 9L3 16c-1 .8-.4 2 1 2h16c1.4 0 2-1.2 1-2z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8 20h8M9 17h6" />
    </>
  ),
  runway: (
    <>
      <path d="M9 3l-3 18M15 3l3 18M12 5v2M12 10v2M12 15v2" />
    </>
  ),
  closet: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M12 3v18M10 11v2M14 11v2" />
    </>
  ),
  shop: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.7 1.6 1.6.7-1.6.7L19 21l-.7-1.6-1.6-.7 1.6-.7z" />
    </>
  ),
  volume: (
    <>
      <path d="M4 10h3l5-4v12l-5-4H4z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 10h3l5-4v12l-5-4H4z" />
      <path d="M16 9l5 6M21 9l-5 6" />
    </>
  ),
  body: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M8 21l2-8-3-4h10l-3 4 2 8M7 9l-2 4M17 9l2 4" />
    </>
  ),
  face: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 10h.01M15 10h.01M9 15c1.5 1.3 4.5 1.3 6 0" />
    </>
  ),
  hand: <path d="M8 13V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4L4 12.5a1.5 1.5 0 0 1 2.5-1.5z" />,
  foot: (
    <>
      <path d="M8 4c2 0 3 3 3 6s-1 4-1 6 1 4-1.5 4S6 18 6 15s-1-5-1-7 1-4 3-4z" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="17.5" cy="8.5" r="1.2" />
      <circle cx="18.6" cy="11.8" r="1" />
    </>
  ),
  save: (
    <>
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
      <path d="M9.5 11.5l2 2 3.5-3.5" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth="3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="3" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2M12 14v2" />
    </>
  ),
  hair: (
    <>
      <path d="M5 20c-1-6 0-15 7-15s8 9 7 15" />
      <path d="M8 20c0-5 1-9 4-11 3 2 4 6 4 11M12 9c-1 3-3 4-5 4" />
    </>
  ),
  brush: (
    <>
      <path d="M14 4l6 6-8 8-6-6z" />
      <path d="M6 12l-2 6 6-2" />
    </>
  ),
  nail: (
    <>
      <path d="M8 21v-9a4 4 0 0 1 8 0v9" />
      <path d="M9.5 11.5c0-3 1-6 2.5-8 1.5 2 2.5 5 2.5 8a2.5 2.5 0 0 1-5 0z" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  star: <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 10h.01M15.5 10h.01M8 14c2 2.5 6 2.5 8 0" />
    </>
  ),
  wink: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 10h.01M14 10.5c.8-.8 2-.8 2.8 0M8.5 14.5c2 2 5 2 7-.5" />
    </>
  ),
  pout: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 10h.01M15.5 10h.01M10.5 15c1-.8 2-.8 3 0-1 .9-2 .9-3 0z" />
    </>
  ),
  grin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 10h.01M15.5 10h.01M8 13.5h8c-.6 2.6-2.2 3.6-4 3.6s-3.4-1-4-3.6zM8.6 15h6.8" />
    </>
  ),
  laugh: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M7.8 10.2c.6-.9 1.6-.9 2.2 0M14 10.2c.6-.9 1.6-.9 2.2 0M8 13.2h8c-.5 3-2.2 4.2-4 4.2s-3.5-1.2-4-4.2z" />
    </>
  ),
  surprise: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 9.5h.01M15.5 9.5h.01M7.8 7.2c.6-.5 1.4-.6 2-.3M16.2 7.2c-.6-.5-1.4-.6-2-.3" />
      <ellipse cx="12" cy="15" rx="1.6" ry="2" />
    </>
  ),
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="3" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  edit: <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 13V9M10 3h4" />
    </>
  ),
  plane: <path d="M3 13l18-8-6 16-3-7zM12 14l3-3" />,
  shirt: <path d="M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z" />,
  pants: <path d="M7 3h10l1 18h-4l-2-11-2 11H6z" />,
  dress: <path d="M9 3h6l-1 5 5 13H5l5-13z" />,
  jacket: (
    <>
      <path d="M8 4l-4 3v13h4v-8M16 4l4 3v13h-4v-8M8 4l4 6 4-6" />
      <path d="M8 12v8h8v-8" />
    </>
  ),
  shoe: <path d="M4 17V8l3 1 3 4 7 1.5c2 .5 3 1.5 3 3V19H4z" />,
  bag: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="3" />
      <path d="M8 9V7a4 4 0 0 1 8 0v2" />
    </>
  ),
  gem: <path d="M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16 3-16" />,
  glasses: (
    <>
      <circle cx="7" cy="13" r="3.5" />
      <circle cx="17" cy="13" r="3.5" />
      <path d="M10.5 13h3M3.5 12L2 9M20.5 12L22 9" />
    </>
  ),
  hat: <path d="M3 17c3 1.5 15 1.5 18 0M6 16.5c0-6 2-10 6-10s6 4 6 10" />,
  bow: (
    <>
      <path d="M12 12L4 7v10zM12 12l8-5v10z" />
      <circle cx="12" cy="12" r="1.8" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </>
  ),
  disco: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 2v4M5 13h14M12 6c-3 3-3 11 0 14M12 6c3 3 3 11 0 14" />
    </>
  ),
  butterfly: (
    <>
      <path d="M12 8v11M12 9c-2-4-8-6-8-1s5 5 8 4M12 9c2-4 8-6 8-1s-5 5-8 4M12 13c-2 1-6 3-4 6s4-3 4-6M12 13c2 1 6 3 4 6s-4-3-4-6" />
    </>
  ),
  guitar: (
    <>
      <path d="M14 10l6-6M18 4l2 2" />
      <path d="M13 9c-2-1-5 0-5 3-3 0-5 2-4 5s4 4 6 3 2-3 2-4c3 0 4-3 3-5z" />
    </>
  ),
  sneaker: <path d="M3 16V9h4l2 2h2l7 3c2 .8 3 1.5 3 3v1H3zM3 18h18" />,
  flower: (
    <>
      <circle cx="12" cy="10" r="2.2" />
      <path d="M12 7.8c-1-3 2-4 2-1M14.2 10c3-1 4 2 1 2M12 12.2c1 3-2 4-2 1M9.8 10c-3 1-4-2-1-2M12 13v8M12 17c2-2 4-2 5-1" />
    </>
  ),
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 4.5l3 2 3-2M9 19.5l3-2 3 2" />,
  sunset: (
    <>
      <path d="M7 16a5 5 0 0 1 10 0M3 16h18M5 20h14M12 4v4M5 9l1.5 1.5M19 9l-1.5 1.5" />
    </>
  ),
  moon: <path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10z" />,
  shell: (
    <>
      <path d="M12 20L4 10c2-4 5-6 8-6s6 2 8 6z" />
      <path d="M12 20L9 6M12 20l3-14M12 20L6.5 8M12 20l5.5-12" />
    </>
  ),
  wand: (
    <>
      <path d="M4 20L15 9" />
      <path d="M17 3l.9 2.1L20 6l-2.1.9L17 9l-.9-2.1L14 6l2.1-.9z" />
    </>
  ),
  pose: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 7v7l-3 7M12 14l3 7M12 9l5-3M12 9l-4 2 1 3" />
    </>
  ),
  sticker: (
    <>
      <path d="M5 4h10l4 4v10a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M15 4v4h4M9 13l1.5 1.5L14 11" />
    </>
  ),
  frame: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </>
  ),
  play: <path d="M8 5l11 7-11 7z" />,
}

export function Icon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {P[name]}
    </svg>
  )
}

/** Moneda de purpurina. */
export function Coin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <defs>
        <radialGradient id="cg" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff7d0" />
          <stop offset="0.5" stopColor="#ffd25a" />
          <stop offset="1" stopColor="#d4900f" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#cg)" stroke="#fff" strokeWidth="2" />
      <path d="M16 8l1.8 4.6 4.9.4-3.7 3.2 1.2 4.8L16 18.4 11.8 21l1.2-4.8L9.3 13l4.9-.4z" fill="#fff" opacity="0.9" />
    </svg>
  )
}
