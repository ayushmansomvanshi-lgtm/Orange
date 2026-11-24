const base = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
export const IconSearch = (p) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconClose = (p) => (<svg {...base} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>);
export const IconDownload = (p) => (<svg {...base} {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16" /></svg>);
export const IconExternal = (p) => (<svg {...base} {...p}><path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);
export const IconSun = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const IconMoon = (p) => (<svg {...base} {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>);
export const IconStop = (p) => (<svg {...base} {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>);
export const IconGlobe = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>);
export const IconPrint = (p) => (<svg {...base} {...p}><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z" /></svg>);
export const IconArrow = (p) => (<svg {...base} {...p}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>);
export const Logo = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="var(--brand)" />
    <circle cx="14.5" cy="14.5" r="6" fill="none" stroke="var(--brand-ink)" strokeWidth="2.4" />
    <path d="m19 19 5.5 5.5" stroke="var(--brand-ink)" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);
