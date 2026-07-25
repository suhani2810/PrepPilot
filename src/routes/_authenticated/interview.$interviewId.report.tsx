import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import {
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Target,
  MessageSquareQuote,
} from "lucide-react";
import {
  DimensionBar,
  EmptyState,
  ReadinessGauge,
  SectionEyebrow,
  Skeleton,
  Stat,
  Surface,
} from "@/components/prep/primitives";

export const Route = createFileRoute("/_authenticated/interview/$interviewId/report")({
  head: () => ({
    meta: [
      { title: "Interview Report — PrepPilot" },
      {
        name: "description",
        content:
          "Detailed post-interview report with dimension scores, strengths, gaps, and ideal answers.",
      },
    ],
  }),
  component: Report,
});

type Interview = {
  role: string;
  overall_score: number | null;
  readiness_score: number | null;
  completed_at: string | null;
  final_report: {
    dimensions: Record<string, number>;
    overall: number;
    readiness: number;
    strengths: string[];
    weaknesses: string[];
  } | null;
};
type Msg = {
  id: string;
  role: "ai" | "user";
  content: string;
  order_index: number;
  topic: string | null;
  difficulty: number | null;
};
type Ev = {
  interview_message_id: string;
  overall_score: number | null;
  strengths: string[] | null;
  missing_concepts: string[] | null;
  ideal_answer: string | null;
  weaknesses: string[] | null;
};

const DIM_LABELS: Record<string, string> = {
  technicalAccuracy: "Technical Accuracy",
  clarity: "Clarity",
  relevance: "Relevance",
  problemSolving: "Problem Solving",
  communication: "Communication",
};

function Report() {
  const { interviewId } = Route.useParams();
  const [iv, setIv] = useState<Interview | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [evals, setEvals] = useState<Record<string, Ev>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: i }, { data: m }, { data: e }] = await Promise.all([
        supabase
          .from("interviews")
          .select("role, overall_score, readiness_score, final_report, completed_at")
          .eq("id", interviewId)
          .single(),
        supabase
          .from("interview_messages")
          .select("id,role,content,order_index,topic,difficulty")
          .eq("interview_id", interviewId)
          .order("order_index"),
        supabase
          .from("evaluations")
          .select(
            "interview_message_id, overall_score, strengths, weaknesses, missing_concepts, ideal_answer",
          )
          .eq("interview_id", interviewId),
      ]);
      setIv(i as Interview);
      setMessages((m ?? []) as Msg[]);
      const map: Record<string, Ev> = {};
      (e ?? []).forEach((ev) => {
        map[ev.interview_message_id] = ev as unknown as Ev;
      });
      setEvals(map);
      setLoading(false);
    })();
  }, [interviewId]);

  if (loading) return <ReportSkeleton />;
  if (!iv)
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 text-muted-foreground">Report not found.</div>
    );

  const r = iv.final_report;
  const dims = r?.dimensions ?? {
    technicalAccuracy: 0,
    clarity: 0,
    relevance: 0,
    problemSolving: 0,
    communication: 0,
  };
  const radarData = Object.entries(dims).map(([k, v]) => ({
    name: DIM_LABELS[k] ?? k,
    value: Number(v) || 0,
  }));

  const pairs: { q: Msg; a: Msg | null }[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "ai") {
      const nxt = messages[i + 1]?.role === "user" ? messages[i + 1] : null;
      pairs.push({ q: messages[i], a: nxt });
    }
  }
  const answered = pairs.filter((p) => p.a).length;

  if (answered === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <SectionEyebrow>Report</SectionEyebrow>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{iv.role}</h1>
        <EmptyState
          className="mt-8"
          icon={<MessageSquareQuote className="h-5 w-5" />}
          title="Nothing to score yet"
          description="You didn't submit any answers this session, so there's nothing to evaluate. Jump back in — even a rough attempt beats a blank page."
          action={
            <div className="flex justify-center gap-2">
              <Link to="/dashboard">
                <Button variant="outline">Dashboard</Button>
              </Link>
              <Link to="/interview/new">
                <Button className="bg-gradient-primary text-primary-foreground">
                  Start a new interview
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  // Actionable next steps derived from the report — never invented.
  const weakDims = Object.entries(dims)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .slice(0, 2)
    .map(([k]) => DIM_LABELS[k] ?? k);
  const nextSteps = [
    r?.weaknesses?.length
      ? `Practice targeted questions around: ${r.weaknesses.slice(0, 3).join(", ")}.`
      : null,
    weakDims.length ? `Focus your next session on ${weakDims.join(" and ")}.` : null,
    "Re-run this role with the same duration to measure improvement.",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionEyebrow>Post-interview report</SectionEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
            {iv.role}
          </h1>
          {iv.completed_at && (
            <p className="mt-1 text-sm text-muted-foreground">
              Completed {new Date(iv.completed_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
          <Link to="/history">
            <Button variant="outline">History</Button>
          </Link>
          <Link to="/interview/$interviewId/roadmap" params={{ interviewId }}>
            <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> View Learning Roadmap{" "}
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <Surface elevated className="relative mt-6 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
          <ReadinessGauge value={iv.readiness_score ?? 0} size={200} label="Readiness" />
          <div>
            <SectionEyebrow>Overall performance</SectionEyebrow>
            <p className="mt-3 font-display text-5xl font-semibold tabular-nums text-gradient sm:text-6xl">
              {iv.overall_score ?? 0}
              <span className="text-2xl text-muted-foreground">/10</span>
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Questions" value={answered} />
              <Stat
                label="Best dimension"
                value={<span className="text-xl">{topDim(dims, "max")}</span>}
                hint={`${maxScore(dims).toFixed(1)}/10`}
              />
              <Stat
                label="Weakest dimension"
                value={<span className="text-xl">{topDim(dims, "min")}</span>}
                hint={`${minScore(dims).toFixed(1)}/10`}
              />
            </div>
          </div>
        </div>
      </Surface>

      {/* Dimensions + radar */}
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
        <Surface className="p-6">
          <SectionEyebrow>Five-dimensional breakdown</SectionEyebrow>
          <div className="mt-5 space-y-4">
            {Object.entries(dims).map(([k, v]) => (
              <DimensionBar key={k} label={DIM_LABELS[k] ?? k} value={Number(v) || 0} />
            ))}
          </div>
        </Surface>
        <Surface className="p-6">
          <SectionEyebrow>Skill radar</SectionEyebrow>
          <div className="mt-2 h-64">
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius={90}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} />
                <PolarRadiusAxis
                  domain={[0, 10]}
                  stroke="var(--muted-foreground)"
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  dataKey="value"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.28}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Surface>
      </div>

      {/* Strengths, gaps, next steps */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Surface className="p-6">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" /> Strengths
          </h3>
          {r?.strengths?.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {r.strengths.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[color:var(--success)]">•</span> {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Strengths will appear here after your next session.
            </p>
          )}
        </Surface>
        <Surface className="p-6">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-highlight" /> Areas to improve
          </h3>
          {r?.weaknesses?.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {r.weaknesses.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-highlight">•</span> {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing flagged. Do harder sessions to surface gaps.
            </p>
          )}
        </Surface>
        <Surface className="p-6">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-primary" /> Next steps
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {nextSteps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">→</span> {s}
              </li>
            ))}
          </ul>
          <Link to="/interview/$interviewId/roadmap" params={{ interviewId }}>
            <Button
              size="sm"
              className="mt-4 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> View learning roadmap
            </Button>
          </Link>
          <Link to="/interview/new">
            <Button size="sm" variant="outline" className="mt-2 w-full">
              Practice again
            </Button>
          </Link>
        </Surface>
      </div>

      {/* Q by Q */}
      <div className="mt-10">
        <SectionEyebrow>Question by question</SectionEyebrow>
        <h2 className="mt-2 font-display text-2xl font-semibold">Every turn, dissected.</h2>
        <div className="mt-6 space-y-4">
          {pairs.map(({ q, a }, i) => {
            const ev = a ? evals[a.id] : undefined;
            return (
              <Surface key={q.id} className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full border border-border/70 bg-secondary/50 px-2 py-0.5 font-mono">
                      Q{i + 1}
                    </span>
                    {q.topic && (
                      <Badge variant="outline" className="text-[10px]">
                        {q.topic}
                      </Badge>
                    )}
                    {q.difficulty && (
                      <Badge variant="outline" className="text-[10px]">
                        Difficulty {q.difficulty}/5
                      </Badge>
                    )}
                  </div>
                  {ev?.overall_score != null && (
                    <span className="rounded-md border border-border/70 bg-secondary/50 px-2 py-0.5 text-xs tabular-nums">
                      {ev.overall_score}
                      <span className="text-muted-foreground">/10</span>
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[15px] font-medium leading-relaxed">{q.content}</p>
                {a ? (
                  <div className="mt-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Your answer
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{a.content}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No answer submitted.</p>
                )}

                {ev && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {ev.strengths?.length ? (
                      <ReviewList label="What went well" tone="success" items={ev.strengths} />
                    ) : null}
                    {ev.missing_concepts?.length ? (
                      <ReviewList label="What was missed" tone="warn" items={ev.missing_concepts} />
                    ) : null}
                    {ev.ideal_answer ? (
                      <div className="md:col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-primary">
                          <Sparkles className="h-3 w-3" /> Ideal answer
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                          {ev.ideal_answer}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </Surface>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReviewList({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "success" | "warn";
  items: string[];
}) {
  const dot = tone === "success" ? "bg-[color:var(--success)]" : "bg-highlight";
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <ul className="mt-1.5 space-y-1 text-sm">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${dot}`} />{" "}
            <span className="min-w-0 flex-1 text-muted-foreground">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function topDim(d: Record<string, number>, mode: "max" | "min") {
  const arr = Object.entries(d);
  if (!arr.length) return "—";
  const pick = arr.reduce((a, b) =>
    mode === "max" ? (Number(a[1]) >= Number(b[1]) ? a : b) : Number(a[1]) <= Number(b[1]) ? a : b,
  );
  return DIM_LABELS[pick[0]] ?? pick[0];
}
function maxScore(d: Record<string, number>) {
  return Math.max(...Object.values(d).map(Number));
}
function minScore(d: Record<string, number>) {
  return Math.min(...Object.values(d).map(Number));
}

function ReportSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-3 h-10 w-64" />
      <Skeleton className="mt-6 h-56 w-full" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
