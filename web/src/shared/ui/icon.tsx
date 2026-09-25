/**
 * The interface's icons, drawn once in the design boards and kept here as inline SVG: stroke in
 * the current colour, so an icon takes the colour of the text next to it. No icon library.
 */
const paths = {
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-3.5-3.5",
  back: "m15 18-6-6 6-6",
  "chevron-right": "m9 18 6-6-6-6",
  "chevron-down": "m6 9 6 6 6-6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
  alert: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7.5v5.5M12 16.5v.2",
  info: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v6M12 7.3v.2",
  clock: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  sun: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z",
  auto: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 3a9 9 0 0 1 0 18z",
  lock: "M4 11h16v10H4zM8 11V7.5a4 4 0 0 1 8 0V11",
  chat: "M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.8-5.2A8.5 8.5 0 1 1 21 11.5z",
  phone:
    "M5 3.5h3.5l2 5-2.5 1.6a11 11 0 0 0 5.9 5.9l1.6-2.5 5 2v3.5a2 2 0 0 1-2 2A17 17 0 0 1 3 5.5a2 2 0 0 1 2-2z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7L20 8.5M20 3.5v5h-5",
  wifioff:
    "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.4M19 12.9a10 10 0 0 0-2-1.5M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M12 20h.01",
} as const;

export type IconName = keyof typeof paths;

interface IconProps {
  readonly name: IconName;
  /** In pixels: 16 inside a chip or a line of help, 20 by default, 24 on a tab. */
  readonly size?: 16 | 20 | 24 | 32;
  /** Only when the icon stands alone; next to text it is decoration and stays unnamed. */
  readonly label?: string;
}

export function Icon({ name, size = 20, label }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label === undefined ? true : undefined}
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      className="shrink-0"
    >
      <path d={paths[name]} />
    </svg>
  );
}
