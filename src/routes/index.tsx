import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PrepNav } from "@/components/PrepNav";
import { useAuth } from "@/hooks/useAuth";
import { SectionEyebrow, SectionHeader, Surface } from "@/components/prep/primitives";
import {
  FileText, Brain, MessageSquare, LineChart, PuzzleIcon, RefreshCw,
  Layers, Sparkles, ArrowRight, CheckCircle2, Target, Compass, Github, Linkedin,
} from "lucide-react";

const creators = [
  { name: "Divyam Madan", github: "https://github.com/Divyam-Madan", linkedin: "https://www.linkedin.com/in/divyam-madan/" },
  { name: "Suhani Mahajan", github: "https://github.com/suhani2810", linkedin: "https://www.linkedin.com/in/suhani-mahajan-2431b8328/" },
];


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrepPilot — From Resume to Ready" },
      { name: "description", content: "The AI career cockpit that reads your resume, runs adaptive interviews, evaluates every answer, and builds your path to interview readiness." },
      { property: "og:title", content: "PrepPilot — From Resume to Ready" },
      { property: "og:description", content: "The AI career cockpit for interview readiness. Resume-aware, adaptive, measurable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const problems = [
  { icon: Layers, title: "Generic Preparation", body: "Question banks that ignore who you are, what you built, and what you're actually interviewing for." },
  { icon: FileText, title: "No Resume Context", body: "Prep tools never open your resume — so they never ask about the projects that will really come up." },
  { icon: Brain, title: "Static Interviewing", body: "Real interviewers dig deeper when you're strong and pivot when you're weak. Static tools can't." },
  { icon: PuzzleIcon, title: "Fragmented Feedback", body: "Scattered rubrics, no clear picture of a great answer, no next step you can act on." },
  { icon: RefreshCw, title: "No Improvement Loop", body: "You practice, get a score, and forget. Nothing compounds across sessions." },
];

const pillars = [
  { icon: FileText, title: "Resume Intelligence", body: "Upload your resume once. PrepPilot extracts your skills, projects, technologies, and interview angles into a structured candidate profile." },
  { icon: Compass, title: "Adaptive Interviewing", body: "An interviewer that references your actual work, calibrates difficulty in real time, and pivots when you drift." },
  { icon: Target, title: "Evaluation Intelligence", body: "Every answer scored across five dimensions with strengths, gaps, and an ideal answer you can learn from." },
  { icon: LineChart, title: "Improvement Loop", body: "A rolling readiness score, personalized focus areas, and a clear path from where you are to where the room needs you to be." },
];

function Landing() {
  const { session } = useAuth();
  const authed = !!session;
  const primaryCta = authed ? { to: "/dashboard", label: "Open Dashboard" } : { to: "/auth", label: "Start preparing free" };

  return (
    <div className="min-h-screen text-foreground">
      <PrepNav authed={authed} />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-0 bg-hero" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          {/* Copy */}
          <div className="animate-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-ring" />
              Adaptive AI interview intelligence
            </div>
            <h1 className="mt-6 font-display text-[2.75rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
              From <span className="text-gradient">Resume</span><br />to <span className="italic font-light">Ready.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
              PrepPilot is the AI career cockpit that reads your resume, runs a live adaptive
              interview, evaluates every answer, and builds your path to interview readiness.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={primaryCta.to} search={authed ? undefined : { mode: "signup" }}>
                <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                  {primaryCta.label} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#how"><Button size="lg" variant="outline">See how it works</Button></a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {["Resume-aware", "Adaptive difficulty", "Five-dimensional scoring", "Readiness tracking"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Interactive-feel interview preview */}
          <HeroPreview />
        </div>
      </section>

      {/* ============ PROBLEM ============ */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeader
            eyebrow="The problem"
            title="Interview preparation is broken."
            description="You practice hard, walk into the room, and get asked something no prep tool ever showed you."
          />
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map((p, i) => (
              <Surface key={p.title} interactive className="p-6 animate-in-up" >
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-secondary/60 text-primary">
                  <p.icon className="h-4 w-4" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
                <span className="absolute right-4 top-4 font-mono text-[10px] text-muted-foreground/60">0{i + 1}</span>
              </Surface>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS / PILLARS ============ */}
      <section id="how" className="relative border-t border-border/60">
        <div className="absolute inset-0 bg-hero opacity-50" />
        <div className="relative mx-auto max-w-6xl px-6 py-24">
          <SectionHeader
            eyebrow="Meet PrepPilot"
            title="A closed loop between your resume, the interviewer, and your growth."
            description="Four capabilities working together — not another question bank."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {pillars.map((p, i) => (
              <Surface key={p.title} className="p-7">
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pillar 0{i + 1}</span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </Surface>
            ))}
          </div>
        </div>
      </section>

      {/* ============ IMPROVEMENT LOOP ============ */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeader
            eyebrow="The loop"
            title="Practice that compounds."
            description="Every session feeds the next. Weak areas become the focus, strong areas get harder, your readiness score climbs."
          />
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: FileText, title: "Understand", body: "Parse your resume into a structured candidate profile." },
              { icon: Compass, title: "Interview", body: "Adaptive AI interviewer, tailored per session." },
              { icon: Target, title: "Evaluate", body: "Five-dimensional scoring on every answer." },
              { icon: Sparkles, title: "Improve", body: "Ideal answers, missing concepts, focus areas." },
              { icon: LineChart, title: "Track", body: "Readiness score climbs across sessions." },
            ].map((s, i) => (
              <div key={s.title} className="relative">
                <Surface className="h-full p-5">
                  <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-secondary/60 text-primary">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] font-semibold tracking-tight">{i + 1}. {s.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                </Surface>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative border-t border-border/60">
        <div className="absolute inset-0 bg-hero opacity-70" />
        <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
          <SectionEyebrow>Ready when the room is</SectionEyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Your first adaptive interview<br />is two minutes away.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Upload your resume, pick a role, and step into a focused interview room with an AI that already knows your story.
          </p>
          <div className="mt-8">
            <Link to={primaryCta.to} search={authed ? undefined : { mode: "signup" }}>
              <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                {authed ? "Open Dashboard" : "Create your free account"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-sm font-semibold tracking-tight text-foreground">PrepPilot</p>
            <p className="mt-1 text-muted-foreground">From Resume to Ready.</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Built by</p>
            <ul className="mt-2 space-y-1.5">
              {creators.map((c) => (
                <li key={c.name} className="flex items-center gap-2 sm:justify-end">
                  <span className="text-foreground/90">{c.name}</span>
                  <a
                    href={c.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${c.name} on GitHub`}
                    title={`${c.name} on GitHub`}
                    className="text-muted-foreground transition hover:text-primary"
                  >
                    <Github className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={c.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${c.name} on LinkedIn`}
                    title={`${c.name} on LinkedIn`}
                    className="text-muted-foreground transition hover:text-primary"
                  >
                    <Linkedin className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-border/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-4 text-[11px] text-muted-foreground sm:flex-row">
            <span>© {new Date().getFullYear()} PrepPilot · Interview intelligence</span>
            <span className="font-mono tracking-widest">FROM RESUME · TO READY</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

/* ============ Hero interview preview ============ */
function HeroPreview() {
  return (
    <div className="animate-in-up [animation-delay:120ms]">
      <Surface elevated className="relative overflow-hidden p-5">
        {/* subtle glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-highlight/15 blur-3xl" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-primary text-primary-foreground">
              <MessageSquare className="h-3 w-3" />
            </span>
            <span className="text-xs font-medium">Live interview — Backend Engineer</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">18:24</span>
        </div>

        {/* Transcript */}
        <div className="relative mt-4 space-y-3 text-sm">
          <PreviewBubble role="ai" topic="System Design" difficulty={3}>
            You listed a real-time analytics project on your resume. How did you handle out-of-order events in that pipeline?
          </PreviewBubble>
          <PreviewBubble role="user">
            We used event-time watermarks with a small lateness window and side-outputted anything beyond it for reprocessing…
          </PreviewBubble>
          <PreviewBubble role="ai" topic="System Design" difficulty={4}>
            Good — how did you tune the lateness window without inflating latency for the 99th percentile?
          </PreviewBubble>

          {/* Thinking */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Evaluating answer · preparing follow-up
          </div>
        </div>

        {/* Score chip */}
        <div className="mt-5 flex items-center justify-between rounded-lg border border-border/60 bg-secondary/50 px-3 py-2 text-[11px]">
          <span className="text-muted-foreground">This turn</span>
          <div className="flex items-center gap-3 font-mono text-foreground">
            <span>Tech <b>8.1</b></span>
            <span>Clarity <b>7.4</b></span>
            <span>Comm <b>7.9</b></span>
          </div>
        </div>
      </Surface>
    </div>
  );
}

function PreviewBubble({
  role, children, topic, difficulty,
}: { role: "ai" | "user"; children: React.ReactNode; topic?: string; difficulty?: number }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed border ${
          role === "user"
            ? "bg-primary/15 border-primary/30 text-foreground"
            : "bg-card border-border/70 text-foreground"
        }`}
      >
        {topic && (
          <div className="mb-1 flex gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            <span>{topic}</span>{difficulty && <span>· Lv {difficulty}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
