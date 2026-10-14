import type { ReactElement, SVGProps } from "react";

export type IconName =
  | "home"
  | "calendar"
  | "heart"
  | "users"
  | "bell"
  | "chart"
  | "clock"
  | "star"
  | "chevron-right"
  | "arrow-left"
  | "plus"
  | "search"
  | "check"
  | "x"
  | "alert"
  | "info"
  | "lightbulb"
  | "logout"
  | "edit"
  | "mail"
  | "phone"
  | "drop"
  | "ruler"
  | "clipboard"
  | "stethoscope"
  | "pill"
  | "wallet"
  | "sparkles";

const PATHS: Record<IconName, ReactElement> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  heart: (
    <path d="M12 20.5S3.5 15 3.5 8.9C3.5 5.9 5.9 3.5 8.7 3.5c1.7 0 3.2.9 4.1 2.3h-2.4c1.9-1.4 3.4-2.3 5.1-2.3 2.8 0 5 2.4 5 5.4C20.5 15 12 20.5 12 20.5Z" />
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.9c1.8.8 3 2.4 3 4.6" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  star: (
    <path d="m12 3 2.7 5.8 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3.1 1.2-6.2L3 9.6l6.3-.8L12 3Z" />
  ),
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  "arrow-left": (
    <>
      <path d="M20 12H4" />
      <path d="m10 6-6 6 6 6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9.5v5M12 17.2v.3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.3" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9V16h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3Z" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8 6 12l4 4M6 12h10" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m14 6 4 4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  phone: (
    <path d="M7 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6L17 12.5 21 14v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 5 5.2 2 2 0 0 1 7 3Z" />
  ),
  drop: <path d="M12 3s6.5 7 6.5 11.2a6.5 6.5 0 1 1-13 0C5.5 10 12 3 12 3Z" />,
  ruler: (
    <>
      <rect x="2" y="8" width="20" height="8" rx="2" transform="rotate(-15 12 12)" />
      <path d="m8 9.8 1 2M12 8.8l1 2M16 7.8l1 2" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6H9V4.5ZM9 11h6M9 15h4" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M4.5 3h3M12.5 3h3M10 12v2.5a5 5 0 0 0 10 0V13" />
      <circle cx="20" cy="11" r="2" />
    </>
  ),
  pill: (
    <>
      <rect x="3" y="9" width="18" height="6.5" rx="3.25" transform="rotate(-45 12 12)" />
      <path d="m9 9 6 6" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M3 10h18M16.5 14.5h.01" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5 13.8 9l5.7 1.9-5.7 1.9L12 18.3l-1.8-5.5-5.7-1.9L10.2 9 12 3.5Z" />
      <path d="M19 15.5v3M17.5 17h3" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export default function Icon({ name, size = 20, className = "", ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
