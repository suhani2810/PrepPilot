import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getOrGenerateRoadmap } from "@/lib/interview.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  Video,
} from "lucide-react";
import { EmptyState, SectionEyebrow, Skeleton, Surface } from "@/components/prep/primitives";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interview/$interviewId/roadmap")({
  head: () => ({
    meta: [
      { title: "Learning Roadmap — PrepPilot" },
      {
        name: "description",
        content:
          "Your personalized study plan built from real interview weaknesses — ordered, actionable, resume-aware.",
      },
    ],
  }),
  component: RoadmapPage,
});

type Step = {
  title: string;
  why: string;
  actions: string[];
  resources: { label: string; kind: "article" | "video" | "practice" | "book" }[];
  estimatedHours: number;
};
type Roadmap = {
  summary: string;
  targetRole: string;
  priorityFocus: string[];
  weakDimensions: string[];
  steps: Step[];
  quickWins: string[];
  practiceInterviewPrompts: string[];
  generatedAt: string;
};

function RoadmapPage() {
  const { interviewId } = Route.useParams();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchFn = useServerFn(getOrGenerateRoadmap);

  const load = async (force = false) => {
    if (force) setRegenerating(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchFn({ data: { interviewId, force } });
      setRoadmap(res.roadmap as Roadmap);
      setCached(res.cached);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load roadmap";
      setError(msg);
      if (force) toast.error(msg);
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    load(false); /* eslint-disable-next-line */
  }, [interviewId]);

  if (loading) return <RoadmapSkeleton />;

  if (error || !roadmap) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <SectionEyebrow>Learning Roadmap</SectionEyebrow>
        <EmptyState
          className="mt-8"
          icon={<BookOpen className="h-5 w-5" />}
          title="No roadmap available"
          description={
            error ??
            "Complete an interview with at least one answered question to generate a personalized roadmap."
          }
          action={
            <div className="flex justify-center gap-2">
              <Link to="/interview/$interviewId/report" params={{ interviewId }}>
                <Button variant="outline">Back to report</Button>
              </Link>
              <Link to="/dashboard">
                <Button className="bg-gradient-primary text-primary-foreground">Dashboard</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const totalHours = roadmap.steps.reduce((a, s) => a + (Number(s.estimatedHours) || 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <SectionEyebrow>Personalized learning roadmap</SectionEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
            Your path to <span className="text-gradient">{roadmap.targetRole}</span> readiness
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{roadmap.summary}</p>
          <p className="mt-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            {cached ? "Loaded from your saved plan" : "Freshly generated"} ·{" "}
            {new Date(roadmap.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/interview/$interviewId/report" params={{ interviewId }}>
            <Button variant="outline">Back to report</Button>
          </Link>
          <Button variant="outline" onClick={() => load(true)} disabled={regenerating}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
      </div>

      {/* Priority summary */}
      <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Surface elevated className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-primary" /> Priority focus
          </h3>
          {roadmap.priorityFocus?.length ? (
            <ol className="mt-4 space-y-2.5">
              {roadmap.priorityFocus.map((p, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">{p}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No priorities yet.</p>
          )}
        </Surface>

        <Surface className="p-6">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-highlight" /> Weakest dimensions
          </h3>
          {roadmap.weakDimensions?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {roadmap.weakDimensions.map((d) => (
                <Badge
                  key={d}
                  variant="outline"
                  className="border-highlight/40 bg-highlight/10 text-highlight-foreground"
                >
                  {d}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No weak dimensions identified.</p>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> ~{totalHours}h of focused study across{" "}
            {roadmap.steps.length} steps
          </p>
        </Surface>
      </div>

      {/* Quick wins */}
      {roadmap.quickWins?.length > 0 && (
        <Surface className="mt-4 border-[color:var(--success)]/30 bg-[color:var(--success)]/5 p-6">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-[color:var(--success)]" /> Quick wins — knock these
            out today
          </h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {roadmap.quickWins.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[color:var(--success)]" />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      {/* Steps */}
      <div className="mt-8">
        <SectionEyebrow>Study plan</SectionEyebrow>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          {roadmap.steps.length} steps, ordered by impact.
        </h2>
        <div className="mt-6 space-y-4">
          {roadmap.steps.map((s, i) => (
            <Surface key={i} className="p-6">
              <div className="grid grid-cols-[auto_1fr_auto] items-start gap-4">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-gradient-primary font-display text-sm font-semibold text-primary-foreground shadow-glow">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold leading-tight">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.why}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  <Clock className="mr-1 h-3 w-3" /> ~{s.estimatedHours}h
                </Badge>
              </div>
              {s.actions?.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Actions
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {s.actions.map((a, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {s.resources?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        Suggested resources
                      </p>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {s.resources.map((r, j) => (
                          <li key={j} className="flex items-start gap-2">
                            <ResourceIcon kind={r.kind} />
                            <span>
                              <span className="text-muted-foreground">[{r.kind}]</span> {r.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Surface>
          ))}
        </div>
      </div>

      {/* Next mock prompts */}
      {roadmap.practiceInterviewPrompts?.length > 0 && (
        <Surface className="mt-8 p-6">
          <SectionEyebrow>Try these in your next mock</SectionEyebrow>
          <ul className="mt-4 space-y-2 text-sm">
            {roadmap.practiceInterviewPrompts.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary">→</span> <span>{p}</span>
              </li>
            ))}
          </ul>
          <Link to="/interview/new">
            <Button className="mt-5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
              Start next interview <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </Surface>
      )}
    </div>
  );
}

function ResourceIcon({ kind }: { kind: "article" | "video" | "practice" | "book" }) {
  const cls = "mt-0.5 h-3.5 w-3.5 flex-none text-muted-foreground";
  if (kind === "video") return <Video className={cls} />;
  if (kind === "book") return <BookOpen className={cls} />;
  if (kind === "practice") return <Target className={cls} />;
  return <BookOpen className={cls} />;
}

function RoadmapSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-3 h-10 w-96" />
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}
