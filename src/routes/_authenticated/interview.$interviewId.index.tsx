import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { submitAnswer, endInterview } from "@/lib/interview.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, User, StopCircle, Send, Loader2, Clock, Maximize2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interview/$interviewId/")({
  head: () => ({ meta: [{ title: "Interview — PrepPilot" }] }),
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch { /* noop */ }
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
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Countdown — stops the moment interview ends
  useEffect(() => {
    if (!startedAt || durationMinutes == null) return;
    if (expired || finishedRef.current) return;
    const endTime = new Date(startedAt).getTime() + durationMinutes * 60_000;

    const tick = () => {
      if (finishedRef.current) return;
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setExpired(true);
        finish("Time's up — generating your report.");
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationMinutes, expired, finish]);

  // Anti-cheat: end interview if user leaves the tab or exits fullscreen
  useEffect(() => {
    if (finishedRef.current) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !finishedRef.current) {
        finish("You left the interview window — ending session.");
      }
    };
    const onBlur = () => {
      // brief tolerance for OS-level focus loss
      setShowAntiCheatWarning(true);
      window.setTimeout(() => setShowAntiCheatWarning(false), 2500);
    };
    const onFsChange = () => {
      if (!document.fullscreenElement && !finishedRef.current && startedAt) {
        finish("Exited fullscreen — ending interview.");
      }
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
    try {
      await containerRef.current?.requestFullscreen();
    } catch {
      toast.error("Couldn't enter fullscreen.");
    }
  };

  const send = async () => {
    if (!answer.trim() || sending || expired || finishedRef.current) return;
    const text = answer.trim();
    setAnswer("");
    setSending(true);
    setMessages((prev) => [...prev, {
      id: `tmp-${Date.now()}`, role: "user", content: text, topic: null, difficulty: null, order_index: prev.length,
    }]);
    try {
      await submitFn({ data: { interviewId, answer: text } });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSending(false);
    }
  };

  const end = async () => {
    if (finishedRef.current) return;
    if (!confirm("End the interview and generate your report?")) return;
    await finish();
  };

  const timerColor = timeLeft == null ? "text-muted-foreground" : timeLeft <= 60 ? "text-red-400" : timeLeft <= 300 ? "text-amber-400" : "text-muted-foreground";

  return (
    <div ref={containerRef} className="mx-auto flex h-[calc(100vh-64px)] max-w-3xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Interview</p>
          <h1 className="font-display text-xl font-semibold">{role}</h1>
        </div>
        <div className="flex items-center gap-3">
          {timeLeft != null && (
            <div className={`flex items-center gap-1.5 text-sm font-medium ${timerColor}`}>
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={enterFullscreen} disabled={ending || expired}>
            <Maximize2 className="mr-2 h-4 w-4" /> Fullscreen
          </Button>
          <Button variant="outline" size="sm" onClick={end} disabled={ending}>
            <StopCircle className="mr-2 h-4 w-4" /> End Interview
          </Button>
        </div>
      </div>

      {showAntiCheatWarning && !expired && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4" /> Stay focused on the interview window — leaving will end the session.
        </div>
      )}

      {(expired || ending) && (
        <div className="mb-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
          Wrapping up and generating your report…
        </div>
      )}

      <Card className="flex flex-1 flex-col overflow-hidden border-border/60 bg-card/40">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "ai" && (
                <div className="mt-1 grid h-8 w-8 flex-none place-items-center rounded-md bg-gradient-primary text-white">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                m.role === "user" ? "bg-primary/15 text-foreground border border-primary/30"
                  : "bg-secondary/60 text-foreground border border-border/60"
              }`}>
                {m.topic && m.role === "ai" && (
                  <div className="mb-1 flex gap-1">
                    <Badge variant="outline" className="text-[10px]">{m.topic}</Badge>
                    {m.difficulty ? <Badge variant="outline" className="text-[10px]">Lv {m.difficulty}</Badge> : null}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
              {m.role === "user" && (
                <div className="mt-1 grid h-8 w-8 flex-none place-items-center rounded-md bg-secondary">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Evaluating and preparing next question…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border/60 p-3">
          <div className="flex gap-2">
            <Textarea
              placeholder={expired ? "Interview ended" : "Type your answer…"}
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
              disabled={sending || expired || ending}
              className="resize-none"
            />
            <Button onClick={send} disabled={sending || expired || ending || !answer.trim()} className="bg-gradient-primary text-white hover:opacity-90">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Tip: ⌘/Ctrl + Enter to send · Leaving the tab or exiting fullscreen ends the interview.</p>
        </div>
      </Card>
    </div>
  );
}
