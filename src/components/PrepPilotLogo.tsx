import { cn } from "@/lib/utils";

/**
 * PrepPilot mark — a minimal geometric "cockpit horizon" glyph.
 * A ring (radar/horizon) with an ascending vector arrow inside — the pilot's rising trajectory.
 */
export function PrepPilotMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="pp-mark-grad"
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="oklch(0.62 0.15 215)" />
          <stop offset="100%" stopColor="oklch(0.82 0.13 195)" />
        </linearGradient>
      </defs>
      {/* outer ring */}
      <circle cx="16" cy="16" r="13" stroke="url(#pp-mark-grad)" strokeWidth="1.75" />
      {/* horizon */}
      <path
        d="M5 18 Q 16 14 27 18"
        stroke="url(#pp-mark-grad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* ascending vector */}
      <path
        d="M10.5 21 L 21.5 10 M 21.5 10 H 15.8 M 21.5 10 V 15.7"
        stroke="url(#pp-mark-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PrepPilotLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <PrepPilotMark size={compact ? 24 : 28} />
      <span
        className={cn(
          "font-sans font-semibold leading-none tracking-tight text-foreground",
          compact ? "text-[1.05rem]" : "text-[1.2rem]",
        )}
      >
        Prep<span className="text-gradient">Pilot</span>
      </span>
    </div>
  );
}
