import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

/* ---------- Section header ---------- */
export function SectionEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      <span className="h-px w-6 bg-current opacity-40" />
      {children}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <SectionEyebrow>{eyebrow}</SectionEyebrow>}
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.6rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/* ---------- Card surface ---------- */
export function Surface({
  children,
  className,
  elevated = false,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border/70 bg-card/80 backdrop-blur-sm",
        elevated && "shadow-soft",
        interactive && "transition-all duration-300 hover:border-primary/40 hover:shadow-glow",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Stat ---------- */
export function Stat({
  label,
  value,
  hint,
  icon,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <Surface elevated className="p-5">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          {icon && <span className="text-primary">{icon}</span>}
          {label}
        </span>
        {trend && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px]",
              trend === "up" &&
                "bg-[color-mix(in_oklab,var(--success)_15%,transparent)] text-[color:var(--success)]",
              trend === "down" && "bg-destructive/10 text-destructive",
              trend === "flat" && "bg-muted text-muted-foreground",
            )}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-[2.25rem] font-semibold leading-none tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </Surface>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Surface
      className={cn(
        "flex flex-col items-center justify-center gap-3 border-dashed py-12 px-6 text-center",
        className,
      )}
    >
      {icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full border border-border/70 bg-secondary/40 text-primary">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </Surface>
  );
}

/* ---------- Gauge (circular readiness) ---------- */
export function ReadinessGauge({
  value,
  size = 180,
  label = "Readiness",
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  return (
    <div
      className="relative inline-flex flex-col items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient
            id="gauge-grad"
            x1="0"
            y1="0"
            x2={size}
            y2={size}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="oklch(0.62 0.15 215)" />
            <stop offset="100%" stopColor="oklch(0.82 0.13 195)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#gauge-grad)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-semibold tabular-nums text-gradient">
          {Math.round(v)}
          <span className="text-lg text-muted-foreground">%</span>
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ---------- Score dimension bar ---------- */
export function DimensionBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {value.toFixed(1)}
          <span className="text-xs text-muted-foreground">/10</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-primary transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
