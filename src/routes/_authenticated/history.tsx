import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock3, Compass } from "lucide-react";
import { EmptyState, SectionEyebrow, Skeleton, Surface } from "@/components/prep/primitives";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Interview History — PrepPilot" },
      {
        name: "description",
        content:
          "Every past interview session, scored and searchable — track your progress from resume to ready.",
      },
    ],
  }),
  component: History,
});

type Row = {
  id: string;
  role: string;
  status: string;
  overall_score: number | null;
  readiness_score: number | null;
  started_at: string;
  completed_at: string | null;
  experience_level: string | null;
  interview_types: string[] | null;
};

function History() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [roadmapIds, setRoadmapIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setRows([]);
        return;
      }
      const [{ data }, { data: rms }] = await Promise.all([
        supabase
          .from("interviews")
          .select(
            "id,role,status,overall_score,readiness_score,started_at,completed_at,experience_level,interview_types",
          )
          .eq("user_id", u.user.id)
          .order("started_at", { ascending: false }),
        // Only surface a "Roadmap" affordance for interviews that already have one saved;
        // do NOT generate roadmaps merely by opening History.
        supabase.from("learning_roadmaps").select("interview_id").eq("user_id", u.user.id),
      ]);
      setRows((data ?? []) as Row[]);
      setRoadmapIds(new Set((rms ?? []).map((r) => r.interview_id as string)));
    })();
  }, []);

  if (rows === null) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-3 h-10 w-56" />
        <div className="mt-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Group by day for a timeline feel
  const grouped = rows.reduce<Record<string, Row[]>>((acc, r) => {
    const day = new Date(r.started_at).toDateString();
    (acc[day] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionEyebrow>Timeline</SectionEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
            Interview history
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Every session you've run, most recent first. Open a report to see the full breakdown.
          </p>
        </div>
        <Link to="/interview/new">
          <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            Start new <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<Compass className="h-5 w-5" />}
          title="No sessions yet"
          description="Start your first adaptive interview to begin building your history."
          action={
            <Link to="/interview/new">
              <Button className="bg-gradient-primary text-primary-foreground">
                Start your first interview
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="mt-8 space-y-8">
          {Object.entries(grouped).map(([day, items]) => (
            <section key={day}>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  {day}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-3">
                {items.map((r) => (
                  <Surface
                    key={r.id}
                    interactive
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 sm:p-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{r.role}</p>
                        {r.experience_level && (
                          <Badge variant="outline" className="text-[10px]">
                            {r.experience_level}
                          </Badge>
                        )}
                        <Badge
                          variant={r.status === "completed" ? "outline" : "secondary"}
                          className="text-[10px]"
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />{" "}
                          {new Date(r.started_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {r.interview_types?.length ? (
                          <span>· {r.interview_types.join(" · ")}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {r.overall_score != null && (
                        <div className="hidden text-right sm:block">
                          <p className="font-display text-xl font-semibold tabular-nums text-gradient">
                            {r.overall_score}
                            <span className="text-xs text-muted-foreground">/10</span>
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            Overall
                          </p>
                        </div>
                      )}
                      {r.status === "completed" ? (
                        <>
                          <Link to="/interview/$interviewId/report" params={{ interviewId: r.id }}>
                            <Button size="sm" variant="outline">
                              Report
                            </Button>
                          </Link>
                          {roadmapIds.has(r.id) && (
                            <Link
                              to="/interview/$interviewId/roadmap"
                              params={{ interviewId: r.id }}
                            >
                              <Button size="sm" variant="ghost" className="hidden sm:inline-flex">
                                Roadmap
                              </Button>
                            </Link>
                          )}
                        </>
                      ) : (
                        <Link to="/interview/$interviewId" params={{ interviewId: r.id }}>
                          <Button size="sm" variant="outline">
                            Resume
                          </Button>
                        </Link>
                      )}
                    </div>
                  </Surface>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
