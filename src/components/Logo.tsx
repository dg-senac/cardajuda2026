export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 font-extrabold tracking-tight"
      style={{ fontSize: size, color: "var(--color-primaria)" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M24 41S6 29.6 6 17.8C6 11.3 11.1 6.5 17 6.5c3.6 0 6.9 1.9 8.8 4.9h-3.6C28.1 8.4 31.4 6.5 35 6.5c5.9 0 11 4.8 11 11.3C46 29.6 24 41 24 41Z"
          fill="url(#cardiajuda-gradient)"
        />
        <path
          d="M10 22h5l3-7 4 14 3-9 2.5 4H38"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="cardiajuda-gradient" x1="6" y1="6.5" x2="46" y2="41" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8B008B" />
            <stop offset="1" stopColor="#4B0049" />
          </linearGradient>
        </defs>
      </svg>
      cardiajuda
    </span>
  );
}
