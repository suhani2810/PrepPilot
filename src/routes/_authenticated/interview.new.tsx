import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { startInterview } from "@/lib/interview.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interview/new")({
  head: () => ({ meta: [{ title: "New Interview — PrepPilot" }] }),
  component: NewInterview,
});

const ROLES = ["Software Development", "Frontend", "Backend", "Full Stack", "AI/ML", "Data Science", "HR/Behavioral", "Custom"];
const LEVELS = ["Intern", "Entry", "Junior", "Mid", "Senior", "Staff", "Principal"];

function NewInterview() {
  const nav = useNavigate();
  const startFn = useServerFn(startInterview);
  const [role, setRole] = useState("Software Development");
  const [customRole, setCustomRole] = useState("");
  const [level, setLevel] = useState("Mid");
  const [types, setTypes] = useState<string[]>(["Technical"]);
  const [jd, setJd] = useState("");
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);

  const toggle = (t: string) =>
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!types.length) return toast.error("Pick at least one interview type");
    setBusy(true);
    try {
      const finalRole = role === "Custom" ? (customRole.trim() || "Custom") : role;
      const { interviewId } = await startFn({
        data: {
          role: finalRole, experienceLevel: level, interviewTypes: types,
          jobDescription: jd || undefined, durationMinutes: duration,
        },
      });
      nav({ to: "/interview/$interviewId", params: { interviewId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm text-muted-foreground">Configure</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">New interview</h1>

      <Card className="mt-6 border-border/60 bg-card/60 p-6">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label>Target role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
            {role === "Custom" && (
              <Input className="mt-2" placeholder="Describe the role" value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
            )}
          </div>

          <div>
            <Label>Experience level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Interview type</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {["Technical", "Resume", "Behavioral"].map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={types.includes(t)} onCheckedChange={() => toggle(t)} /> {t}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="jd">Job description (optional)</Label>
            <Textarea id="jd" rows={5} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste a JD to further tailor questions" />
          </div>

          <div>
            <Label htmlFor="dur">Duration (minutes)</Label>
            <Input id="dur" type="number" min={5} max={180} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>

          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-white hover:opacity-90">
            {busy ? "Preparing your interviewer…" : "Start Interview"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
