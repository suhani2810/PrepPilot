import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { submitAnswer, endInterview } from "@/lib/interview.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  StopCircle, Send, Loader2, Clock, Maximize2, ShieldAlert, Mic, Radio, Volume2, KeyboardIcon, User,
} from "lucide-react";
import { toast } from "sonner";
import { PrepPilotMark } from "@/components/PrepPilotLogo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/interview/$interviewId/")({
  head: () => ({
    meta: [
      { title: "Interview Room — PrepPilot" },
      { name: "description", content: "Your live adaptive interview room. Focused, timed, resume-aware." },
    ],
  }),
  component: InterviewRoom,
});

type Msg = { id: string; role: "ai" | "user"; content: string; topic: string | null; difficulty: number | null; order_index: number };

function formatTime(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function InterviewRoom() {
  const { interviewId } = Route.useParams();
  const nav = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [role, setRole] = useState<string>("");
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [showAntiCheatWarning, setShowAntiCheatWarning] = useState(false);
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [voiceListening, setVoiceListening] = useState(false); // UI-only placeholder for future voice module
  const bottomRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submitFn = useServerFn(submitAnswer);
  const endFn = useServerFn(endInterview);

  const finish = useCallback(async (reason?: string) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setEnding(true);
    if (reason) toast.message(reason);
    try {
      await endFn({ data: { interviewId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save report — showing what we have.");
    } finally {
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* noop */ }
      nav({ to: "/interview/$interviewId/report", params: { interviewId }, replace: true });
    }
  }, [endFn, interviewId, nav]);

  const load = async () => {
    const [{ data: iv }, { data: msgs }] = await Promise.all([
      supabase.from("interviews").select("role, status, duration_minutes, started_at").eq("id", interviewId).single(),
      supabase.from("interview_messages")
        .select("id, role, content, topic, difficulty, order_index")
        .eq("interview_id", interviewId).order("order_index", { ascending: true }),
    ]);
    if (iv) {
      setRole(iv.role);
      setDurationMinutes(iv.duration_minutes);
      setStartedAt(iv.started_at);
      if (iv.status === "completed") {
        finishedRef.current = true;
        nav({ to: "/interview/$interviewId/report", params: { interviewId }, replace: true });
        return;
      }
    }
    setMessages((msgs ?? []) as Msg[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [interviewId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  // Countdown
  useEffect(() => {
    if (!startedAt || durationMinutes == null) return;
    if (expired || finishedRef.current) return;
    const endTime = new Date(startedAt).getTime() + durationMinutes * 60_000;
    const tick = () => {
      if (finishedRef.current) return;
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) { setExpired(true); finish("Time's up — generating your report."); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationMinutes, expired, finish]);

  // Anti-cheat listeners
  useEffect(() => {
    if (finishedRef.current) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !finishedRef.current) finish("You left the interview window — ending session.");
    };
    const onBlur = () => {
      setShowAntiCheatWarning(true);
      window.setTimeout(() => setShowAntiCheatWarning(false), 2500);
    };
    const onFsChange = () => {
      if (!document.fullscreenElement && !finishedRef.current && startedAt) finish("Exited fullscreen — ending interview.");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [finish, startedAt]);

  const enterFullscreen = async () => {
    try { await containerRef.current?.requestFullscreen(); }
    catch { toast.error("Couldn't enter fullscreen."); }
  };

  const send = async () => {
    if (!answer.trim() || sending || expired || finishedRef.current) return;
    const text = answer.trim();
    setAnswer("");
    setSending(true);
    setMessages((prev) => [...prev, {
      id: `tmp-${Date.now()}`, role: "user", content: text, topic: null, difficulty: null, order_index: prev.length,
    }]);
    try { await submitFn({ data: { interviewId, answer: text } }); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed to submit"); }
    finally { setSending(false); textareaRef.current?.focus(); }
  };

  const end = async () => {
    if (finishedRef.current) return;
    if (!confirm("End the interview and generate your report?")) return;
    await finish();
  };

  const timerTone = timeLeft == null ? "text-muted-foreground" : timeLeft <= 60 ? "text-destructive" : timeLeft <= 300 ? "text-highlight" : "text-muted-foreground";
  const timerPct = useMemo(() => {
    if (durationMinutes == null || timeLeft == null) return 100;
    return Math.max(0, Math.min(100, (timeLeft / (durationMinutes * 60)) * 100));
  }, [timeLeft, durationMinutes]);

  const currentQ = [...messages].reverse().find((m) => m.role === "ai");
  const answered = messages.filter((m) => m.role === "user").length;

  return (
    <div ref={containerRef} className="relative flex min-h-[calc(100vh-64px)] flex-col bg-background text-foreground">
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0 bg-hero opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />

      {/* Timer progress bar */}
      {timeLeft != null && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-border/40">
          <div
            className={cn(
              "h-full transition-[width] duration-1000 ease-linear",
              timeLeft <= 60 ? "bg-destructive" : timeLeft <= 300 ? "bg-highlight" : "bg-primary",
            )}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <PrepPilotMark size={26} />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Live interview</p>
              <p className="truncate text-sm font-semibold">{role || "Preparing…"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {timeLeft != null && (
              <div className={cn("flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-sm font-medium tabular-nums", timerTone)}>
                <Clock className="h-3.5 w-3.5" />
                {formatTime(timeLeft)}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={enterFullscreen} disabled={ending || expired}>
              <Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Focus
            </Button>
            <Button variant="outline" size="sm" onClick={end} disabled={ending} className="text-destructive hover:text-destructive">
              <StopCircle className="mr-1.5 h-3.5 w-3.5" /> End
            </Button>
          </div>
        </div>
      </header>

      {/* Warnings */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6">
        {showAntiCheatWarning && !expired && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-2 text-sm text-highlight-foreground">
            <ShieldAlert className="h-4 w-4 text-highlight" /> Stay focused — leaving this window or exiting fullscreen ends the interview.
          </div>
        )}
        {(expired || ending) && (
          <div className="mt-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
            Wrapping up and generating your report…
          </div>
        )}
      </div>

      {/* Main split */}
      <main className="relative z-10 mx-auto grid w-full max-w-5xl flex-1 gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[280px_1fr]">
        {/* Interviewer presence panel */}
        <aside className="order-2 space-y-3 lg:order-1">
          <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card/70 p-5 backdrop-blur">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
                  <PrepPilotMark size={26} className="[&_circle]:stroke-white [&_path]:stroke-white" />
                </div>
                {sending && (
                  <span className="absolute -inset-1 rounded-full border border-primary/40 animate-pulse-ring" />
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Interviewer</p>
                <p className="font-display text-lg font-semibold">PrepPilot AI</p>
                <p className="text-[11px] text-muted-foreground">{sending ? "Evaluating your answer…" : "Listening"}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-xs">
              <MetaRow label="Current topic" value={currentQ?.topic ?? "—"} />
              <MetaRow label="Difficulty" value={currentQ?.difficulty ? `Level ${currentQ.difficulty} / 5` : "—"} />
              <MetaRow label="Answered" value={`${answered} ${answered === 1 ? "question" : "questions"}`} />
            </div>
          </div>

          {/* Mode toggle (voice prepared, text default) */}
          <div className="rounded-xl border border-border/70 bg-card/70 p-3 backdrop-blur">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Answer mode</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-secondary/40 p-1">
              <button
                type="button"
                onClick={() => setMode("text")}
                className={cn("inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition", mode === "text" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <KeyboardIcon className="h-3.5 w-3.5" /> Text
              </button>
              <button
                type="button"
                onClick={() => { setMode("voice"); toast.info("Voice mode is coming soon."); }}
                className={cn("inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition", mode === "voice" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Mic className="h-3.5 w-3.5" /> Voice
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Voice interview module lands soon. Your session remains fully in text.</p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/40 p-3 text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground">Focus rules</p>
            <ul className="mt-1.5 space-y-1">
              <li>· Leaving the tab ends the session</li>
              <li>· Exiting fullscreen ends the session</li>
              <li>· ⌘ / Ctrl + Enter sends your answer</li>
            </ul>
          </div>
        </aside>

        {/* Conversation */}
        <section className="order-1 flex min-h-[60vh] flex-col rounded-xl border border-border/70 bg-card/60 backdrop-blur lg:order-2">
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing your first question…
              </div>
            )}
            {messages.map((m) => (
              <Bubble key={m.id} m={m} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Evaluating · preparing next question
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-border/70 p-4">
            {mode === "voice" ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-secondary/30 p-6 text-center">
                <button
                  type="button"
                  disabled
                  onClick={() => setVoiceListening((v) => !v)}
                  className={cn(
                    "relative grid h-14 w-14 place-items-center rounded-full border transition",
                    voiceListening ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border/70 bg-card text-muted-foreground",
                  )}
                  aria-label="Voice mode (coming soon)"
                >
                  {voiceListening ? <Radio className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}
                </button>
                <p className="text-xs text-muted-foreground">Voice interview module coming soon. Switch back to text to answer.</p>
                <Button variant="outline" size="sm" onClick={() => setMode("text")}>Use text mode</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={textareaRef}
                    placeholder={expired ? "Interview ended" : "Type your answer… (⌘/Ctrl + Enter to send)"}
                    rows={3}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
                    disabled={sending || expired || ending}
                    className="resize-none bg-background/60"
                  />
                  <Button
                    onClick={send}
                    disabled={sending || expired || ending || !answer.trim()}
                    className="h-[92px] w-14 shrink-0 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                    aria-label="Send answer"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <Volume2 className="mr-1 inline h-3 w-3" />
                  A separate voice module will listen and transcribe here without changing your interview.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  if (m.role === "ai") {
    return (
      <div className="flex gap-3">
        <div className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-soft">
          <PrepPilotMark size={16} className="[&_circle]:stroke-white [&_path]:stroke-white" />
        </div>
        <div className="min-w-0 flex-1">
          {(m.topic || m.difficulty) && (
            <div className="mb-1 flex flex-wrap gap-1.5">
              {m.topic && <Badge variant="outline" className="text-[10px]">{m.topic}</Badge>}
              {m.difficulty && <Badge variant="outline" className="text-[10px]">Difficulty {m.difficulty}/5</Badge>}
            </div>
          )}
          <div className="rounded-lg rounded-tl-none border border-border/60 bg-secondary/40 px-4 py-3 text-[15px] leading-relaxed">
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-row-reverse gap-3">
      <div className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full border border-border/70 bg-card text-muted-foreground">
        <User className="h-4 w-4" />
      </div>
      <div className="min-w-0 max-w-[80%] rounded-lg rounded-tr-none border border-primary/30 bg-primary/10 px-4 py-3 text-[15px] leading-relaxed">
        <div className="whitespace-pre-wrap">{m.content}</div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-[11px]">
      <span className="uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate font-medium">{value}</span>
    </div>
  );
}
