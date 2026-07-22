import { cn } from "@/lib/utils";

export function PrepPilotMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pp-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.62 0.17 40)" />
          <stop offset="100%" stopColor="oklch(0.78 0.16 75)" />
        </linearGradient>
      </defs>
      {/* Rounded warm tile */}
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#pp-grad)" />
      {/* Paper-plane / compass arrow — the "pilot" mark */}
      <path
        d="M11 22.5 L28.5 11.5 L23 29 L20.2 22.8 L11 22.5 Z"
        fill="white"
        fillOpacity="0.96"
      />
      <path
        d="M20.2 22.8 L28.5 11.5"
        stroke="oklch(0.35 0.08 40)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeOpacity="0.35"
      />
    </svg>
  );
}

export function PrepPilotLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <PrepPilotMark size={30} />
      <span className="font-display text-[1.35rem] font-semibold leading-none tracking-tight text-foreground">
        Prep<span className="text-primary">Pilot</span>
      </span>
    </div>
  );
}
