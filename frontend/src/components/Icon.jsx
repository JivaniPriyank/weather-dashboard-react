const PATHS = {
  today: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />,
  words: <><rect x="3.5" y="6" width="13" height="14" rx="2" /><path d="M7.5 3.5h11a2 2 0 0 1 2 2v12" /></>,
  practice: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  speaking: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  more: <path d="M4 7h16M4 12h16M4 17h16" />,
  grammar: <><path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h9.5M9 8.5h5" /></>,
  videos: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m10.5 9.5 4 2.5-4 2.5z" /></>,
  progress: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  inbox: <><path d="M3.5 13.5 6 5h12l2.5 8.5V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" /><path d="M3.5 13.5H9l1 2h4l1-2h5.5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.5a6.5 6.5 0 0 1 3 5.5" /></>,
  classes: <><path d="m12 3 9 4.5-9 4.5-9-4.5z" /><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" /></>,
  edit: <path d="M12 20h8.5M16.5 4a2.1 2.1 0 0 1 3 3L8 18.5l-4 1 1-4z" />,
  say: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  chevron: <path d="m9.5 6 6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  account: <><circle cx="12" cy="8.5" r="4" /><path d="M4 20.5a8 8 0 0 1 16 0" /></>,
  out: <path d="M14.5 4.5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4M10 16.5 14.5 12 10 7.5M14.5 12H4" />,
  upload: <path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5M4.5 15v4a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" />,
  again: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" />,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  // icons a teacher can give one of their sections
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  book: <path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9.5" />,
  chat: <path d="M4 5.5h16v10H9l-5 4z" />,
  headphones: <path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  globe: <path d="M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M3.5 12h17M12 3.5c2.5 2.5 2.5 14.5 0 17M12 3.5c-2.5 2.5-2.5 14.5 0 17" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
};

export const SECTION_ICONS = ["star", "book", "chat", "headphones", "bulb", "flag", "globe", "pencil"];

export default function Icon({ name, label }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" role={label ? "img" : undefined} aria-label={label || undefined}
      aria-hidden={label ? undefined : "true"}>
      {PATHS[name]}
    </svg>
  );
}

// The German Lab logo: a flask with two speech bubbles and a German-flag drop,
// redrawn as a vector from the logo on the teacher's lesson slides.
export function BrandMark({ className = "brand-mark" }) {
  return (
    <svg className={className} viewBox="-1 1.5 66 66" aria-hidden="true">
      <defs>
        <clipPath id="glm-body"><circle cx="18" cy="51.5" r="9.6" /></clipPath>
        <clipPath id="glm-flag"><circle cx="22.5" cy="55.5" r="3.4" /></clipPath>
      </defs>
      <circle cx="46.5" cy="25" r="9" fill="#35C2BC" />
      <path d="M40.5 30.5 L37.5 37 L45 32.6 Z" fill="#35C2BC" />
      <path d="M42.5 22.5h8M42.5 26h8M42.5 29.5h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".9" />
      <circle cx="31" cy="14.5" r="11" fill="#1F3A70" />
      <path d="M24.2 22.5 L22 29.5 L30 24.8 Z" fill="#1F3A70" />
      <path d="M24.5 14.5v0M27 12.5v4M29.5 10v9M32 12v5M34.5 9.5v10M37 13v3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx="19" cy="32" r="2" fill="#1F3A70" />
      <circle cx="22.6" cy="29" r="1.3" fill="#1F3A70" />
      <path d="M14 35.5h8M15 35.5v7.2a11 11 0 1 0 6 0v-7.2" fill="#fff" stroke="#1F3A70" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <g clipPath="url(#glm-body)"><path d="M6 50.5q3-2.6 6 0t6 0t6 0t6 0V64H6Z" fill="#1F3A70" /></g>
      <circle cx="16.4" cy="46" r="1.1" fill="#1F3A70" />
      <circle cx="19.6" cy="43.6" r=".8" fill="#1F3A70" />
      <circle cx="12.8" cy="54.2" r="1.3" fill="#fff" />
      <circle cx="15.6" cy="57.6" r="1" fill="#F4C430" />
      <circle cx="12.6" cy="58.6" r=".8" fill="#fff" opacity=".8" />
      <g clipPath="url(#glm-flag)">
        <rect x="19" y="52" width="7" height="2.4" fill="#111" />
        <rect x="19" y="54.3" width="7" height="2.4" fill="#DD2B1C" />
        <rect x="19" y="56.6" width="7" height="2.4" fill="#FFCE00" />
      </g>
    </svg>
  );
}
