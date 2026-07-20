import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { Plus, FileText, TrendingUp, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PrepPilot" }] }),
  component: Dashboard,
});

type Row = {
  id: string; role: string; status: string; overall_score: number | null;
  readiness_score: number | null; started_at: string; completed_at: string | null;
};

function Dashboard() {
  const [interviews, setInterviews] = useState<Row[]>([]);
  const [profile, setProfile] = useState<{ display_name: string | null; readiness_score: number | null } | null>(null);
  const [hasResume, setHasResume] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: ivs }, { data: p }, { data: cp }] = await Promise.all([
        supabase.from("interviews").select("id,role,status,overall_score,readiness_score,started_at,completed_at")
          .eq("user_id", u.user.id).order("started_at", { ascending: false }),
        supabase.from("profiles").select("display_name, readiness_score").eq("id", u.user.id).maybeSingle(),
        supabase.from("candidate_profiles").select("id").eq("user_id", u.user.id).maybeSingle(),
      ]);
      setInterviews(ivs ?? []);
      setProfile(p);
      setHasResume(!!cp);
    })();
  }, []);

  const completed = interviews.filter((i) => i.status === "completed");
  const avg = completed.length
    ? Math.round((completed.reduce((a, i) => a + Number(i.overall_score ?? 0), 0) / completed.length) * 10) / 10
    : 0;
  const readiness = profile?.readiness_score ?? 0;
  const trend = [...completed].reverse().map((i, idx) => ({
    idx: idx + 1, score: Number(i.overall_score ?? 0),
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your interview readiness</h1>
        </div>
        <Link to="/interview/new">
          <Button size="lg" className="bg-gradient-primary text-white shadow-glow hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" /> Start New Interview
          </Button>
        </Link>
      </div>

      {!hasResume && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 border-highlight/40 bg-highlight/5 p-5">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-highlight" />
            <div>
              <p className="font-medium">Upload your resume to unlock personalized interviews</p>
              <p className="text-sm text-muted-foreground">PrepPilot uses it to build every question.</p>
            </div>
          </div>
          <Link to="/resume"><Button variant="outline">Upload resume</Button></Link>
        </Card>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Readiness" value={`${readiness}%`} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Interviews completed" value={String(completed.length)} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Average score" value={`${avg}/10`} />
      </div>

      <Card className="mt-6 border-border/60 bg-card/60 p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Score trend</h2>
        {trend.length ? (
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.03 265)" />
                <XAxis dataKey="idx" stroke="oklch(0.7 0.02 265)" />
                <YAxis domain={[0, 10]} stroke="oklch(0.7 0.02 265)" />
                <Tooltip contentStyle={{ background: "oklch(0.19 0.025 265)", border: "1px solid oklch(0.28 0.03 265)" }} />
                <Line type="monotone" dataKey="score" stroke="oklch(0.65 0.22 270)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Complete an interview to see your trend.</p>
        )}
      </Card>

      <Card className="mt-6 border-border/60 bg-card/60 p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Past interviews</h2>
        {interviews.length ? (
          <ul className="divide-y divide-border/50">
            {interviews.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{i.role}</p>
                  <p className="text-xs text-muted-foreground">{new Date(i.started_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={i.status === "completed" ? "default" : "secondary"}>{i.status}</Badge>
                  {i.overall_score != null && <span className="text-sm tabular-nums">{i.overall_score}/10</span>}
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
        ) : (
          <p className="text-sm text-muted-foreground">No interviews yet. Start your first one!</p>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-border/60 bg-card/60 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon} {label}</div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
