import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart,
} from "recharts";
import { Plus, FileText, TrendingUp, Trophy, Compass, ArrowRight, ChevronRight, Clock3 } from "lucide-react";
import { Stat, Surface, EmptyState, ReadinessGauge, SectionEyebrow, Skeleton } from "@/components/prep/primitives";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PrepPilot" },
      { name: "description", content: "Your interview readiness command center — track scores, resume interviews, and see what to focus on next." },
    ],
  }),
  component: Dashboard,
});

type Row = {
  id: string; role: string; status: string; overall_score: number | null;
  readiness_score: number | null; started_at: string; completed_at: string | null;
  final_report: { dimensions?: Record<string, number>; strengths?: string[]; weaknesses?: string[] } | null;
};

function Dashboard() {
  const [interviews, setInterviews] = useState<Row[] | null>(null);
  const [profile, setProfile] = useState<{ display_name: string | null; readiness_score: number | null } | null>(null);
  const [hasResume, setHasResume] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: ivs }, { data: p }, { data: cp }] = await Promise.all([
        supabase.from("interviews").select("id,role,status,overall_score,readiness_score,started_at,completed_at,final_report")
          .eq("user_id", u.user.id).order("started_at", { ascending: false }),
        supabase.from("profiles").select("display_name, readiness_score").eq("id", u.user.id).maybeSingle(),
        supabase.from("candidate_profiles").select("id").eq("user_id", u.user.id).maybeSingle(),
      ]);
      setInterviews((ivs ?? []) as Row[]);
      setProfile(p);
      setHasResume(!!cp);
    })();
  }, []);

  if (interviews === null) return <DashboardSkeleton />;

  // Only interviews that were actually scored (i.e. had at least one evaluated
  // answer and produced a final report) count toward analytics. Abandoned
  // sessions and zero-answer completions never masquerade as "0/10 performance".
  const scored = interviews.filter(
    (i) => i.status === "completed" && i.overall_score != null,
  );
  const avg = scored.length
    ? Math.round((scored.reduce((a, i) => a + Number(i.overall_score), 0) / scored.length) * 10) / 10
    : null;
  // Readiness is only meaningful once we have at least one scored session.
  const readiness = scored.length > 0 ? (profile?.readiness_score ?? null) : null;
  const trend = [...scored].reverse().map((i, idx) => ({
    idx: idx + 1, score: Number(i.overall_score),
  }));
  const latest = scored[0];
  const active = interviews.find((i) => i.status !== "completed");

  // Aggregate strengths / weaknesses from recent 3 scored reports only.
  const recentReports = scored.slice(0, 3);
  const strengthTally = tally(recentReports.flatMap((r) => r.final_report?.strengths ?? []));
  const weaknessTally = tally(recentReports.flatMap((r) => r.final_report?.weaknesses ?? []));

  // First-run experience: no scored interviews yet. Show a premium empty
  // state instead of fake 0% readiness and empty charts.
  const isFirstRun = scored.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <SectionEyebrow>Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}</SectionEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
            Interview Readiness Command Center
          </h1>
        </div>
        <Link to="/interview/new">
          <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" /> Start Interview
          </Button>
        </Link>
      </div>

      {/* Resume banner */}
      {!hasResume && (
        <Surface className="mt-6 flex flex-wrap items-center justify-between gap-4 border-highlight/40 bg-highlight/5 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-highlight/40 bg-highlight/10 text-highlight">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">Upload your resume to unlock personalized interviews</p>
              <p className="text-sm text-muted-foreground">PrepPilot uses it to build every question.</p>
            </div>
          </div>
          <Link to="/resume"><Button variant="outline">Upload resume <ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></Link>
        </Surface>
      )}

      {active && (
        <Surface className="mt-6 flex flex-wrap items-center justify-between gap-4 border-primary/40 p-5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <div>
              <p className="font-medium">Interview in progress — {active.role}</p>
              <p className="text-sm text-muted-foreground">Started {new Date(active.started_at).toLocaleString()}</p>
            </div>
          </div>
          <Link to="/interview/$interviewId" params={{ interviewId: active.id }}>
            <Button className="bg-gradient-primary text-primary-foreground">Resume session <ArrowRight className="ml-2 h-3.5 w-3.5" /></Button>
          </Link>
        </Surface>
      )}

      {isFirstRun ? (
        /* Premium empty state — no fake metrics, no empty charts. */
        <Surface elevated className="relative mt-6 overflow-hidden p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom--16 h-56 w-56 rounded-full bg-highlight/10 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-center">
            <div>
              <SectionEyebrow>Your dashboard is waiting</SectionEyebrow>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Complete your first interview to unlock your readiness score.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Readiness %, performance trend, strengths, and focus areas all appear here after your first scored session. Nothing is precomputed and nothing is faked — every number comes from an interview you actually took.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to="/interview/new">
                  <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                    <Plus className="mr-2 h-4 w-4" /> Start your first interview
                  </Button>
                </Link>
                {!hasResume && (
                  <Link to="/resume"><Button size="lg" variant="outline">Upload resume first</Button></Link>
                )}
              </div>
              <ul className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-3.5 w-3.5 text-primary" /> Performance trend across sessions</li>
                <li className="flex items-start gap-2"><Trophy className="mt-0.5 h-3.5 w-3.5 text-primary" /> Readiness % from real evaluations</li>
                <li className="flex items-start gap-2"><Compass className="mt-0.5 h-3.5 w-3.5 text-primary" /> Personalized focus areas</li>
                <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary" /> Post-interview learning roadmap</li>
              </ul>
            </div>
            <div className="hidden justify-center md:flex">
              <div className="relative grid h-48 w-48 place-items-center rounded-full border border-dashed border-primary/40 text-center">
                <div>
                  <p className="font-display text-4xl font-semibold text-muted-foreground">—</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Not yet measured</p>
                </div>
              </div>
            </div>
          </div>
        </Surface>
      ) : (
      <>
      {/* Readiness hero */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Surface elevated className="relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <SectionEyebrow>Interview readiness</SectionEyebrow>
              <p className="mt-3 font-display text-5xl font-semibold tabular-nums text-gradient sm:text-6xl">
                {readiness ?? 0}<span className="text-2xl text-muted-foreground">%</span>
              </p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {latest
                  ? `Latest session scored ${latest.overall_score}/10 in ${latest.role}.`
                  : "Rolling average across your completed sessions."}
              </p>
              <Link to="/history" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View full history <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <ReadinessGauge value={readiness ?? 0} />
          </div>
        </Surface>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Stat label="Scored interviews" value={scored.length} icon={<Trophy className="h-3.5 w-3.5" />} hint={`${interviews.length} total session${interviews.length === 1 ? "" : "s"}`} />
          <Stat label="Average score" value={avg != null ? `${avg}` : "—"} icon={<TrendingUp className="h-3.5 w-3.5" />} hint="out of 10 across scored sessions" />
        </div>
      </div>


      {/* Trend + focus */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Surface className="p-6">
          <div className="flex items-center justify-between">
            <SectionEyebrow>Performance trend</SectionEyebrow>
            {trend.length >= 2 && <Badge variant="outline" className="text-[10px]">{trend.length} sessions</Badge>}
          </div>
          {trend.length >= 2 ? (
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="idx" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis domain={[0, 10]} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} fill="url(#dash-area)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              className="mt-4"
              icon={<TrendingUp className="h-5 w-5" />}
              title={trend.length === 1 ? "One data point so far" : "No trend yet"}
              description={trend.length === 1 ? "One more session and your trend line comes to life." : "Complete a couple of interviews to see how you're progressing."}
              action={<Link to="/interview/new"><Button size="sm" className="bg-gradient-primary text-primary-foreground">Start an interview</Button></Link>}
            />
          )}
        </Surface>

        <Surface className="p-6">
          <SectionEyebrow>Focus areas</SectionEyebrow>
          {completed.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Complete a session to see your strongest areas and what to work on.</p>
          ) : (
            <div className="mt-4 space-y-5">
              <FocusList title="Strongest areas" tone="success" items={strengthTally} empty="Strengths will surface after a full session." />
              <FocusList title="Needs attention" tone="warn" items={weaknessTally} empty="Nothing flagged yet." />
            </div>
          )}
        </Surface>
      </div>

      {/* Recent sessions */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr]">
        <Surface className="p-6">
          <div className="flex items-center justify-between">
            <SectionEyebrow>Recent interviews</SectionEyebrow>
            {interviews.length > 5 && <Link to="/history" className="text-xs font-medium text-primary hover:underline">See all</Link>}
          </div>
          {interviews.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={<Compass className="h-5 w-5" />}
              title="No interviews yet"
              description="Configure your first session — role, level, and duration — and step into the interview room."
              action={<Link to="/interview/new"><Button size="sm" className="bg-gradient-primary text-primary-foreground">Start your first interview <ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></Link>}
            />
          ) : (
            <ul className="mt-4 divide-y divide-border/60">
              {interviews.slice(0, 5).map((i) => (
                <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.role}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-3 w-3" /> {new Date(i.started_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Badge variant={i.status === "completed" ? "outline" : "secondary"} className="hidden text-[10px] sm:inline-flex">{i.status}</Badge>
                    {i.overall_score != null && (
                      <span className="rounded-md border border-border/70 bg-secondary/50 px-2 py-0.5 text-xs tabular-nums">
                        {i.overall_score}<span className="text-muted-foreground">/10</span>
                      </span>
                    )}
                    {i.status === "completed" ? (
                      <Link to="/interview/$interviewId/report" params={{ interviewId: i.id }}>
                        <Button size="sm" variant="outline">Report</Button>
                      </Link>
                    ) : (
                      <Link to="/interview/$interviewId" params={{ interviewId: i.id }}>
                        <Button size="sm" variant="outline">Resume</Button>
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </div>
  );
}

function tally(items: string[]) {
  const map = new Map<string, number>();
  items.forEach((i) => { if (i) map.set(i, (map.get(i) ?? 0) + 1); });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, count]) => ({ label, count }));
}

function FocusList({ title, items, tone, empty }: { title: string; tone: "success" | "warn"; items: { label: string; count: number }[]; empty: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((it) => (
            <li key={it.label} className="flex items-start gap-2 text-sm">
              <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${tone === "success" ? "bg-[color:var(--success)]" : "bg-highlight"}`} />
              <span className="min-w-0 flex-1">{it.label}</span>
              {it.count > 1 && <span className="text-[10px] text-muted-foreground">×{it.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-12 w-80" />
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Skeleton className="h-56 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
