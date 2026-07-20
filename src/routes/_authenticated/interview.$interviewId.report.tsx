import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/interview/$interviewId/report")({
  head: () => ({ meta: [{ title: "Interview Report — PrepPilot" }] }),
  component: Report,
});

type Interview = {
  role: string; overall_score: number | null; readiness_score: number | null;
  final_report: {
    dimensions: Record<string, number>;
    overall: number; readiness: number;
    strengths: string[]; weaknesses: string[];
  } | null;
};
type Msg = { id: string; role: "ai" | "user"; content: string; order_index: number };
type Ev = {
  interview_message_id: string; overall_score: number | null;
  strengths: string[] | null; missing_concepts: string[] | null;
  ideal_answer: string | null;
};

function Report() {
  const { interviewId } = Route.useParams();
  const [iv, setIv] = useState<Interview | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [evals, setEvals] = useState<Record<string, Ev>>({});

  useEffect(() => {
    (async () => {
      const [{ data: i }, { data: m }, { data: e }] = await Promise.all([
        supabase.from("interviews").select("role, overall_score, readiness_score, final_report").eq("id", interviewId).single(),
        supabase.from("interview_messages").select("id,role,content,order_index").eq("interview_id", interviewId).order("order_index"),
        supabase.from("evaluations").select("interview_message_id, overall_score, strengths, missing_concepts, ideal_answer").eq("interview_id", interviewId),
      ]);
      setIv(i as Interview);
      setMessages((m ?? []) as Msg[]);
      const map: Record<string, Ev> = {};
      (e ?? []).forEach((ev) => { map[ev.interview_message_id] = ev as unknown as Ev; });
      setEvals(map);
    })();
  }, [interviewId]);

  if (!iv) return <div className="mx-auto max-w-4xl px-6 py-10 text-muted-foreground">Loading report…</div>;
  const r = iv.final_report;
  const dims = r?.dimensions ?? { technicalAccuracy: 0, clarity: 0, relevance: 0, problemSolving: 0, communication: 0 };
  const chartData = [
    { name: "Technical", value: dims.technicalAccuracy },
    { name: "Clarity", value: dims.clarity },
    { name: "Relevance", value: dims.relevance },
    { name: "Problem", value: dims.problemSolving },
    { name: "Communication", value: dims.communication },
  ];

  // Pair AI questions with the following user answer
  const pairs: { q: Msg; a: Msg | null }[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "ai") {
      const nxt = messages[i + 1]?.role === "user" ? messages[i + 1] : null;
      pairs.push({ q: messages[i], a: nxt });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Report</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{iv.role}</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard"><Button variant="outline">Dashboard</Button></Link>
          <Link to="/interview/new"><Button className="bg-gradient-primary text-white hover:opacity-90">New Interview</Button></Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/60 p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-gradient">{iv.overall_score ?? 0}/10</p>
        </Card>
        <Card className="border-border/60 bg-card/60 p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Readiness</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{iv.readiness_score ?? 0}%</p>
        </Card>
        <Card className="border-border/60 bg-card/60 p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Questions answered</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{pairs.filter((p) => p.a).length}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card/60 p-6">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Dimensions</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.03 265)" />
                <XAxis dataKey="name" stroke="oklch(0.7 0.02 265)" fontSize={12} />
                <YAxis domain={[0, 10]} stroke="oklch(0.7 0.02 265)" />
                <Tooltip contentStyle={{ background: "oklch(0.19 0.025 265)", border: "1px solid oklch(0.28 0.03 265)" }} />
                <Bar dataKey="value" fill="oklch(0.65 0.22 270)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="border-border/60 bg-card/60 p-6">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Skill radar</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <RadarChart data={chartData}>
                <PolarGrid stroke="oklch(0.28 0.03 265)" />
                <PolarAngleAxis dataKey="name" stroke="oklch(0.7 0.02 265)" fontSize={11} />
                <PolarRadiusAxis domain={[0, 10]} stroke="oklch(0.4 0.03 265)" />
                <Radar dataKey="value" stroke="oklch(0.65 0.22 270)" fill="oklch(0.65 0.22 270)" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card/60 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-primary" /> Strengths</h3>
          <ul className="space-y-2 text-sm">
            {(r?.strengths ?? []).map((s, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span> {s}</li>)}
            {!r?.strengths?.length && <li className="text-muted-foreground">—</li>}
          </ul>
        </Card>
        <Card className="border-border/60 bg-card/60 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium"><XCircle className="h-4 w-4 text-destructive" /> Weaknesses</h3>
          <ul className="space-y-2 text-sm">
            {(r?.weaknesses ?? []).map((s, i) => <li key={i} className="flex gap-2"><span className="text-destructive">•</span> {s}</li>)}
            {!r?.weaknesses?.length && <li className="text-muted-foreground">—</li>}
          </ul>
        </Card>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Question-by-question review</h2>
      <div className="mt-4 space-y-4">
        {pairs.map(({ q, a }, i) => {
          const ev = a ? evals[a.id] : undefined;
          return (
            <Card key={q.id} className="border-border/60 bg-card/60 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Q{i + 1}</p>
                {ev?.overall_score != null && <Badge variant="outline">{ev.overall_score}/10</Badge>}
              </div>
              <p className="mt-2 font-medium">{q.content}</p>
              {a ? (
                <div className="mt-3 rounded-md border border-border/50 bg-background/40 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Your answer</p>
                  <p className="mt-1 whitespace-pre-wrap">{a.content}</p>
                </div>
              ) : <p className="mt-2 text-sm text-muted-foreground">No answer submitted.</p>}
              {ev && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {ev.strengths?.length ? (
                    <div>
                      <p className="text-xs font-medium text-primary">What went well</p>
                      <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {ev.strengths.map((s, j) => <li key={j}>• {s}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {ev.missing_concepts?.length ? (
                    <div>
                      <p className="text-xs font-medium text-highlight">What was missed</p>
                      <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {ev.missing_concepts.map((s, j) => <li key={j}>• {s}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {ev.ideal_answer ? (
                    <div className="md:col-span-2">
                      <p className="flex items-center gap-1 text-xs font-medium text-primary"><Sparkles className="h-3 w-3" /> Ideal answer</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{ev.ideal_answer}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
