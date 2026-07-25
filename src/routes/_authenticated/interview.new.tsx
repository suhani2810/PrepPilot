import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { startInterview } from "@/lib/interview.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SectionEyebrow, Surface } from "@/components/prep/primitives";
import {
  Clock,
  Target,
  Layers,
  Sparkles,
  ArrowRight,
  Rocket,
  Mic,
  KeyboardIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/interview/new")({
  head: () => ({
    meta: [
      { title: "Configure Interview — PrepPilot" },
      {
        name: "description",
        content: "Configure your next adaptive AI interview — role, level, type, and duration.",
      },
    ],
  }),
  component: NewInterview,
});

const ROLES = [
  "Software Development",
  "Frontend",
  "Backend",
  "Full Stack",
  "AI/ML",
  "Data Science",
  "HR/Behavioral",
  "Custom",
];
const LEVELS = ["Intern", "Entry", "Junior", "Mid", "Senior", "Staff", "Principal"];
const TYPES = [
  { key: "Technical", desc: "Coding & systems reasoning" },
  { key: "Resume", desc: "Deep-dive on your work" },
  { key: "Behavioral", desc: "Situations & judgment" },
];
const DURATIONS = [15, 30, 45, 60];
type InterviewMode = "voice" | "text";

function NewInterview() {
  const nav = useNavigate();
  const startFn = useServerFn(startInterview);
  const [step, setStep] = useState<0 | 1>(0);
  const [role, setRole] = useState("Software Development");
  const [customRole, setCustomRole] = useState("");
  const [level, setLevel] = useState("Mid");
  const [types, setTypes] = useState<string[]>(["Technical"]);
  const [jd, setJd] = useState("");
  const [durationInput, setDurationInput] = useState("30");
  const [interviewMode, setInterviewMode] = useState<InterviewMode | null>(null);
  const [busy, setBusy] = useState(false);

  const finalRole = role === "Custom" ? customRole.trim() || "Custom" : role;
  const duration = Number(durationInput);
  const durationIsValid =
    /^\d+$/.test(durationInput) && Number.isInteger(duration) && duration >= 5 && duration <= 180;
  const toggleType = (t: string) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const review = () => {
    if (!types.length) return toast.error("Pick at least one interview type");
    if (!interviewMode) return toast.error("Choose an interview mode");
    if (!durationIsValid)
      return toast.error("Duration must be a whole number from 5 to 180 minutes");
    setStep(1);
  };

  const start = async () => {
    if (!types.length) return toast.error("Pick at least one interview type");
    if (!interviewMode) return toast.error("Choose an interview mode");
    if (!durationIsValid)
      return toast.error("Duration must be a whole number from 5 to 180 minutes");
    setBusy(true);
    try {
      const result = await startFn({
        data: {
          role: finalRole,
          experienceLevel: level,
          interviewTypes: types,
          jobDescription: jd || undefined,
          durationMinutes: duration,
          interviewMode,
        },
      });
      if (!result?.interviewId) {
        throw new Error("The interview session was not created. Please try again.");
      }
      const { interviewId } = result;
      nav({ to: "/interview/$interviewId", params: { interviewId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionEyebrow>Configure simulation</SectionEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
            New interview
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <StepDot active={step >= 0} label="Configure" />
          <span className="h-px w-8 bg-border" />
          <StepDot active={step >= 1} label="Review" />
        </div>
      </div>

      {step === 0 && (
        <Surface elevated className="mt-6 p-6 sm:p-8">
          <div className="space-y-7">
            {/* Role */}
            <Field label="Target role" icon={<Target className="h-3.5 w-3.5" />}>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {role === "Custom" && (
                <Input
                  className="mt-2"
                  placeholder="Describe the role (e.g. Senior Platform Engineer at a fintech)"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                />
              )}
            </Field>

            {/* Level */}
            <Field label="Experience level" icon={<Layers className="h-3.5 w-3.5" />}>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </Field>

            {/* Type */}
            <Field
              label="Interview type"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              hint="Choose one or more"
            >
              <div className="grid gap-2 sm:grid-cols-3">
                {TYPES.map((t) => {
                  const active = types.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleType(t.key)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition",
                        active
                          ? "border-primary/50 bg-primary/5 shadow-ring"
                          : "border-border/70 bg-card/60 hover:border-primary/30",
                      )}
                    >
                      <p className="text-sm font-medium">{t.key}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Duration */}
            <Field label="Duration" icon={<Clock className="h-3.5 w-3.5" />}>
              <div className="flex flex-wrap items-center gap-2">
                {DURATIONS.map((d) => (
                  <Chip
                    key={d}
                    active={durationIsValid && duration === d}
                    onClick={() => setDurationInput(String(d))}
                  >
                    {d} min
                  </Chip>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Custom</span>
                  <Input
                    type="number"
                    min={5}
                    max={180}
                    step={1}
                    value={durationInput}
                    onChange={(e) => setDurationInput(e.target.value)}
                    className="w-20"
                    aria-invalid={!durationIsValid}
                  />
                </div>
              </div>
              {!durationIsValid && (
                <p className="mt-2 text-xs text-destructive">
                  Enter a whole number between 5 and 180 minutes.
                </p>
              )}
            </Field>

            {/* Mode */}
            <Field label="Interview mode" hint="Required">
              <RadioGroup
                value={interviewMode ?? undefined}
                onValueChange={(value) => setInterviewMode(value as InterviewMode)}
                className="grid gap-3 sm:grid-cols-2"
              >
                <Label
                  htmlFor="interview-mode-voice"
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition",
                    interviewMode === "voice"
                      ? "border-primary/50 bg-primary/5 shadow-ring"
                      : "border-border/70 bg-card/60 hover:border-primary/30",
                  )}
                >
                  <RadioGroupItem id="interview-mode-voice" value="voice" className="mt-0.5" />
                  <Mic className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">
                      Voice Interview <span className="text-primary">(Recommended)</span>
                    </span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      Speak naturally with an AI interviewer.
                    </span>
                  </span>
                </Label>
                <Label
                  htmlFor="interview-mode-text"
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition",
                    interviewMode === "text"
                      ? "border-primary/50 bg-primary/5 shadow-ring"
                      : "border-border/70 bg-card/60 hover:border-primary/30",
                  )}
                >
                  <RadioGroupItem id="interview-mode-text" value="text" className="mt-0.5" />
                  <KeyboardIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">Text Interview</span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      Type your responses instead of speaking.
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </Field>

            {/* JD */}
            <Field label="Job description" hint="Optional — makes questions sharper">
              <Textarea
                rows={4}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the JD to tailor questions to a specific opening."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={review}
                disabled={!types.length || !interviewMode}
                className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                Review <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Surface>
      )}

      {step === 1 && (
        <Surface elevated className="mt-6 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
              <Rocket className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Ready to start
              </p>
              <h2 className="font-display text-2xl font-semibold">Simulation brief</h2>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <ReviewRow label="Target role" value={finalRole} />
            <ReviewRow label="Experience" value={level} />
            <ReviewRow label="Types" value={types.join(" · ")} />
            <ReviewRow label="Duration" value={`${duration} minutes`} />
            <ReviewRow
              label="Interview mode"
              value={interviewMode === "voice" ? "Voice Interview" : "Text Interview"}
            />
            {jd && (
              <ReviewRow
                label="Job description"
                value={`${jd.slice(0, 140)}${jd.length > 140 ? "…" : ""}`}
                className="sm:col-span-2"
              />
            )}
          </dl>

          <div className="mt-6 rounded-lg border border-border/70 bg-secondary/40 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">What happens next</p>
            <ul className="mt-1.5 space-y-1">
              <li>· We build an interview plan tailored to your resume and the settings above.</li>
              <li>
                · You enter a focused interview room; leaving fullscreen or the tab ends the
                session.
              </li>
              <li>
                · Each answer is scored — a full report appears when you finish or time runs out.
              </li>
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(0)} disabled={busy}>
              Back
            </Button>
            <Button
              onClick={start}
              disabled={busy || !interviewMode}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              {busy ? "Preparing your interviewer…" : "Start Interview"}{" "}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Surface>
      )}
    </div>
  );
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {icon} {label}
        </Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ReviewRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-secondary/30 px-4 py-3", className)}>
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary" : "bg-border")} />
      <span className={active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </span>
  );
}
