import { useId } from "react";

/** The Speak Bubble app icon (design/app-icon/gospell-app-icon.svg). */
export function AppIcon({ size = 40 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="100 100 824 824" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF9A2E" /><stop offset="1" stopColor="#FF5A00" /></linearGradient>
        <linearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF9A2E" /><stop offset="1" stopColor="#F25500" /></linearGradient>
      </defs>
      <path d="M285 100h454c102 0 185 83 185 185v454c0 102-83 185-185 185H285c-102 0-185-83-185-185V285c0-102 83-185 185-185z" fill={`url(#b${id})`} />
      <path d="M370 262h284c92 0 166 74 166 166v84c0 92-74 166-166 166H452l-122 96c-14 11-34 0-30-17l22-92c-66-22-118-86-118-153v-84c0-92 74-166 166-166z" fill="#fff" />
      <g fill={`url(#w${id})`}><rect x="338" y="436" width="46" height="62" rx="23" /><rect x="414" y="394" width="46" height="146" rx="23" /><rect x="490" y="344" width="46" height="246" rx="23" /><rect x="566" y="394" width="46" height="146" rx="23" /><rect x="642" y="426" width="46" height="82" rx="23" /></g>
    </svg>
  );
}

const G = "M20.0235 29.5758H17.2142C10.838 29.5561 5.65365 24.3543 5.65365 17.976C5.65365 11.6413 10.7725 6.46567 17.0898 6.38053V10.6721C13.1366 10.755 9.94083 14.0097 9.94083 17.976C9.94083 21.9466 13.1366 25.1991 17.0898 25.282L18.2489 25.2842L18.286 25.2471L23.2149 20.316L23.4288 20.1064H14.4135V15.8149H23.4288L23.2171 15.6032L18.8382 11.2243L21.8724 8.19014L31.6386 17.9585L20.0235 29.5758Z";
/** GoML's G-arrow mark. */
export function GomlMark({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="#FF8600" /><path fill="#fff" d={G} />
    </svg>
  );
}
