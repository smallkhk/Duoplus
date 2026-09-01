/** Single-source icon set. All glyphs are 24×24, 1.6px stroke, currentColor. */

const PATHS: Record<string, string> = {
  cpu: 'M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M6 6h12v12H6z M10 10h4v4h-4z',
  shield: 'M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6l7-3z M9.2 12.2l2 2 3.8-4',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18z M3.6 9h16.8M3.6 15h16.8 M12 3c2.4 2.4 3.6 5.4 3.6 9S14.4 18.6 12 21c-2.4-2.4-3.6-5.4-3.6-9S9.6 5.4 12 3z',
  route: 'M6 4a2.5 2.5 0 100 5 2.5 2.5 0 000-5z M18 15a2.5 2.5 0 100 5 2.5 2.5 0 000-5z M6 9v3a3 3 0 003 3h3a3 3 0 013 3v.5',
  terminal: 'M3 5h18v14H3z M7 10l2.5 2L7 14M12.5 15H17',
  workflow: 'M4 4h6v6H4z M14 14h6v6h-6z M10 7h3a1 1 0 011 1v6',
  users: 'M8 11a3.2 3.2 0 100-6.4A3.2 3.2 0 008 11z M2.5 20a5.5 5.5 0 0111 0 M16 11.2a3 3 0 100-6 M16.5 14.4A5.5 5.5 0 0121.5 20',
  drive: 'M4 15h16l-2.6-8.4A2 2 0 0015.5 5h-7a2 2 0 00-1.9 1.6L4 15z M4 15v3a1 1 0 001 1h14a1 1 0 001-1v-3 M16.5 17h.01',
  message: 'M4 5h16v11H9l-5 4V5z M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01',
  video: 'M3 6h12v12H3z M15 10l6-3.5v11L15 14',
  sync: 'M20 11a8 8 0 00-14.3-4.7M4 13a8 8 0 0014.3 4.7 M4 4v4h4M20 20v-4h-4',
  monitor: 'M3 4h18v12H3z M9 20h6M12 16v4',
  phone: 'M7 2h10a1.5 1.5 0 011.5 1.5v17A1.5 1.5 0 0117 22H7a1.5 1.5 0 01-1.5-1.5v-17A1.5 1.5 0 017 2z M10 5.5h4M11 19h2',
  power: 'M12 3v9 M7.5 6.2a7.5 7.5 0 109 0',
  restart: 'M20 12a8 8 0 11-2.6-5.9 M20 3v5h-5',
  play: 'M7 4.5l12 7.5-12 7.5z',
  pause: 'M8 5h3v14H8z M13 5h3v14h-3z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14z M16.2 16.2L21 21',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  check: 'M4.5 12.5l5 5 10-11',
  x: 'M6 6l12 12M18 6L6 18',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  key: 'M15 3a6 6 0 103.5 10.9L21 16.4V21h-4.5l-2-2-2.6-2.6A6 6 0 0015 3z M17 7.5h.01',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6z M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.2A1.6 1.6 0 006 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 13.9H3a2 2 0 110-4h.2A1.6 1.6 0 004.6 6l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 3V3a2 2 0 114 0v.2a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7H21a2 2 0 110 4h-.2a1.6 1.6 0 00-1.4 1.2z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  wallet: 'M3 7a2 2 0 012-2h12a2 2 0 012 2v1 M3 7v10a2 2 0 002 2h14a2 2 0 002-2v-6H16a2 2 0 100 4h5 M17 13h.01',
  building: 'M4 21V6l7-3v18 M11 10h7a1 1 0 011 1v10 M14.5 14h.01M14.5 17.5h.01M7.5 9h.01M7.5 13h.01M7.5 17h.01M2.5 21h19',
  layers: 'M12 3l9 4.5-9 4.5-9-4.5L12 3z M3 12.5l9 4.5 9-4.5 M3 17l9 4.5 9-4.5',
  upload: 'M12 16V4M8 8l4-4 4 4 M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3',
  download: 'M12 4v12M8 12l4 4 4-4 M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2',
  trash: 'M4 6h16 M9 6V4h6v2 M6.5 6l1 14h9l1-14 M10 10v6M14 10v6',
  refresh: 'M20.5 11a8.5 8.5 0 00-15.2-4.5 M3.5 13a8.5 8.5 0 0015.2 4.5 M20.5 2.5v5h-5M3.5 21.5v-5h5',
  alert: 'M12 4l9 16H3l9-16z M12 10v4M12 17.5h.01',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 11v6M12 7.8h.01',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v5.2l3.2 2',
  sparkle: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z',
  lock: 'M6 10h12v10H6z M8.5 10V7.5a3.5 3.5 0 017 0V10 M12 14v2',
  mail: 'M3 5h18v14H3z M3.5 6l8.5 6.5L20.5 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  logout: 'M15 5V4a1 1 0 00-1-1H5a1 1 0 00-1 1v16a1 1 0 001 1h9a1 1 0 001-1v-1 M10 12h11M18 9l3 3-3 3',
  tag: 'M3 3h8l10 10-8 8L3 11V3z M7.5 7.5h.01',
  server: 'M3 4h18v6H3z M3 14h18v6H3z M7 7h.01M7 17h.01',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  star: 'M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9L12 3.5z',
  arrowRight: 'M4 12h15M13 6l6 6-6 6',
  fingerprint: 'M12 3a8 8 0 018 8v2 M4 11a8 8 0 013.2-6.4 M8 11a4 4 0 018 0v3.5 M12 11v5a5 5 0 01-1 3 M16 16.5c-.4 1.7-1 3-1.8 4 M4 13c0 3 .8 5.4 2 7',
}

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  className = 'size-5',
  strokeWidth = 1.6,
  filled = false,
}: {
  name: string
  className?: string
  strokeWidth?: number
  filled?: boolean
}) {
  const d = PATHS[name] ?? PATHS.info
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : `M${seg}`} />
      ))}
    </svg>
  )
}
