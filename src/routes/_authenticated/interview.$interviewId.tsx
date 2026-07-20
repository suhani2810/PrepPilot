import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { submitAnswer, endInterview } from "@/lib/interview.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, User, StopCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interview/$interviewId")({
  head: () => ({ meta: [{ title: "Interview — PrepPilot" }] }),
  component: InterviewRoom,
});

type Msg = { id: string; role: "ai" | "user"; content: string; topic: string | null; difficulty: number | null; order_index: number };

function InterviewRoom() {
  const { interviewId } = Route.useParams();
  const nav = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [role, setRole] = useState<string>("");
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const submitFn = useServerFn(submitAnswer);
  const endFn = useServerFn(endInterview);

  const load = async () => {
    const [{ data: iv }, { data: msgs }] = await Promise.all([
      supabase.from("interviews").select("role, status").eq("id", interviewId).single(),
      supabase.from("interview_messages")
        .select("id, role, content, topic, difficulty, order_index")
        .eq("interview_id", interviewId).order("order_index", { ascending: true }),
    ]);
    if (iv) {
      setRole(iv.role);
      if (iv.status === "completed") {
        nav({ to: "/interview/$interviewId/report", params: { interviewId } });
        return;
      }
    }
    setMessages((msgs ?? []) as Msg[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [interviewId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!answer.trim() || sending) return;
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
    if (!confirm("End the interview and generate your report?")) return;
    setEnding(true);
    try {
      await endFn({ data: { interviewId } });
      nav({ to: "/interview/$interviewId/report", params: { interviewId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to end");
      setEnding(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-3xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Interview</p>
          <h1 className="text-lg font-semibold">{role}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={end} disabled={ending}>
          <StopCircle className="mr-2 h-4 w-4" /> End Interview
        </Button>
      </div>

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
              placeholder="Type your answer…"
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
              disabled={sending}
              className="resize-none"
            />
            <Button onClick={send} disabled={sending || !answer.trim()} className="bg-gradient-primary text-white hover:opacity-90">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Tip: ⌘/Ctrl + Enter to send</p>
        </div>
      </Card>
    </div>
  );
}
