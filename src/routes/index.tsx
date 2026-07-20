import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PrepNav } from "@/components/PrepNav";
import { useAuth } from "@/hooks/useAuth";
import {
  Target, FileText, Brain, MessageSquare, TrendingUp, LineChart,
  AlertTriangle, PuzzleIcon, RefreshCw, Layers, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrepPilot — From Resume to Ready" },
      { name: "description", content: "Adaptive AI mock interviews that learn from your resume. Practice, get scored on 5 dimensions, and track your interview readiness." },
      { property: "og:title", content: "PrepPilot — From Resume to Ready" },
      { property: "og:description", content: "Adaptive AI mock interviews personalized to your resume." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const problems = [
  { icon: Layers, title: "Generic Preparation", body: "Question banks that ignore who you are, what you built, and what you're interviewing for." },
  { icon: FileText, title: "No Resume Context", body: "Practice tools never open your resume — so they never ask about the projects that will actually come up." },
  { icon: Brain, title: "No Adaptive Interviewing", body: "Real interviewers dig deeper when you're strong and pivot when you're weak. Static tools can't." },
  { icon: PuzzleIcon, title: "Fragmented Feedback", body: "Scattered rubrics, no idea what a great answer looks like, no clear next step." },
  { icon: RefreshCw, title: "No Continuous Improvement Loop", body: "You practice, get a score, and forget. Nothing compounds." },
];

const steps = [
  { icon: FileText, title: "1. Understand", body: "Upload your resume. PrepPilot extracts your skills, projects, and story." },
  { icon: Target, title: "2. Personalize", body: "Pick a role and type — we build an interview plan tailored to you." },
  { icon: MessageSquare, title: "3. Interview", body: "Chat with an adaptive AI interviewer that references your actual work." },
  { icon: Brain, title: "4. Evaluate", body: "Every answer scored on accuracy, clarity, relevance, problem solving, and communication." },
  { icon: Sparkles, title: "5. Improve", body: "See ideal answers, missing concepts, and personalized follow-ups." },
  { icon: LineChart, title: "6. Track", body: "Watch your readiness score climb across sessions." },
];

function Landing() {
  const { session } = useAuth();
  const authed = !!session;
  return (
    <div className="min-h-screen text-foreground">
      <PrepNav authed={authed} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute inset-0" style={{ backgroundImage: "var(--gradient-hero)" }} />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-highlight" /> Adaptive AI Interview Intelligence
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
            <span className="text-gradient">PrepPilot</span>
          </h1>
          <p className="mt-4 text-xl font-medium text-muted-foreground sm:text-2xl">From Resume to Ready.</p>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            An adaptive AI interviewer that reads your resume, personalizes every question,
            evaluates every answer, and turns your prep into a measurable readiness score.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to={authed ? "/dashboard" : "/auth"} search={authed ? undefined : { mode: "signup" }}>
              <Button size="lg" className="bg-gradient-primary text-white shadow-glow hover:opacity-90">
                {authed ? "Go to Dashboard" : "Start preparing free"}
              </Button>
            </Link>
            <a href="#how"><Button size="lg" variant="outline">See how it works</Button></a>
          </div>
        </div>
      </section>

      {/* Problems */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-highlight">
            <AlertTriangle className="h-3.5 w-3.5" /> The problem
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Interview Preparation Is Broken</h2>
          <p className="mt-4 text-muted-foreground">
            You practice hard, walk into the room, and get asked something no prep tool ever showed you.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((p) => (
            <Card key={p.title} className="border-border/60 bg-card/60 p-6 transition hover:border-primary/50">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative border-t border-border/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Meet PrepPilot
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Six steps from resume to ready</h2>
            <p className="mt-4 text-muted-foreground">A closed feedback loop between your resume, the interviewer, and your growth.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((s) => (
              <Card key={s.title} className="relative overflow-hidden border-border/60 bg-card/60 p-6">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
                <div className="relative">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-white">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready when the room is.</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Upload your resume, pick a role, and take your first adaptive interview in under two minutes.
        </p>
        <div className="mt-8">
          <Link to={authed ? "/dashboard" : "/auth"} search={authed ? undefined : { mode: "signup" }}>
            <Button size="lg" className="bg-gradient-primary text-white shadow-glow hover:opacity-90">
              {authed ? "Open Dashboard" : "Create your free account"}
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PrepPilot · Interview intelligence
      </footer>
    </div>
  );
}
