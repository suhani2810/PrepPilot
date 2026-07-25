import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parseResume, updateCandidateProfile } from "@/lib/interview.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  Loader2,
  Brain,
  Layers,
  Wrench,
  ScrollText,
  GraduationCap,
  Rocket,
  X,
} from "lucide-react";
import { SectionEyebrow, Surface, EmptyState, Skeleton } from "@/components/prep/primitives";

type Parsed = {
  summary?: string;
  skills?: string[];
  frameworks?: string[];
  languages?: string[];
  strengthAreas?: string[];
  potentialQuestionAreas?: string[];
  education?: { degree: string; institution: string; year: string }[];
  experience?: { role: string; company: string; duration: string; highlights: string[] }[];
  projects?: {
    name: string;
    description: string;
    technologies: string[];
    possibleInterviewTopics: string[];
  }[];
};

export const Route = createFileRoute("/_authenticated/resume")({
  head: () => ({
    meta: [
      { title: "Resume Intelligence — PrepPilot" },
      {
        name: "description",
        content:
          "Upload your resume and let PrepPilot build a structured candidate profile that powers every interview.",
      },
    ],
  }),
  component: ResumePage,
});

const STAGES = [
  { key: "uploading", label: "Uploading your document", icon: Upload },
  { key: "extracting", label: "Extracting document text", icon: ScrollText },
  { key: "analyzing", label: "Identifying skills & frameworks", icon: Layers },
  { key: "mapping", label: "Mapping projects & experience", icon: Brain },
  { key: "building", label: "Building candidate profile", icon: Sparkles },
] as const;
type StageKey = (typeof STAGES)[number]["key"] | "done" | null;

function ResumePage() {
  const [profile, setProfile] = useState<{ id: string; parsed: Parsed } | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<StageKey>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const parseFn = useServerFn(parseResume);
  const updateFn = useServerFn(updateCandidateProfile);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("candidate_profiles")
      .select("id, parsed")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (data) setProfile({ id: data.id, parsed: (data.parsed as Parsed) ?? {} });
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const advanceStage = () => {
    // Simulate meaningful staged progress while the server runs — never claims completion.
    const order: StageKey[] = ["uploading", "extracting", "analyzing", "mapping", "building"];
    let i = 0;
    setStage(order[0]);
    stageTimer.current = setInterval(() => {
      i = Math.min(i + 1, order.length - 2); // never auto-advance past "building"
      setStage(order[i]);
    }, 3000);
  };
  const stopStages = () => {
    if (stageTimer.current) clearInterval(stageTimer.current);
    stageTimer.current = null;
  };

  const upload = async () => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Choose a PDF resume.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Resume must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    advanceStage();
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const path = `${u.user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;
      await parseFn({ data: { resumePath: path } });
      setStage("done");
      toast.success("Resume analyzed");
      await load();
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setStage(null);
    } finally {
      stopStages();
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!profile) return;
    try {
      const parsed = JSON.parse(draft);
      await updateFn({ data: { id: profile.id, parsed } });
      toast.success("Profile updated");
      setEditing(false);
      await load();
    } catch {
      toast.error("Invalid JSON");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionEyebrow>Resume intelligence</SectionEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
            Your candidate profile
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Upload once. PrepPilot builds a structured profile that powers every question in every
            interview.
          </p>
        </div>
        {profile && !busy && (
          <Badge
            variant="outline"
            className="border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" /> Profile ready
          </Badge>
        )}
      </div>

      {/* Upload / analysis */}
      <Surface elevated className="mt-6 overflow-hidden">
        {busy ? (
          <AnalysisProgress stage={stage} />
        ) : (
          <div className="grid gap-6 p-6 sm:grid-cols-[1.2fr_1fr] sm:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/50 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                <Upload className="h-3 w-3" /> {profile ? "Replace resume" : "Upload resume"}
              </div>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                {profile ? "Update your candidate profile" : "Start with your PDF resume"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We extract skills, frameworks, projects, and interview angles into a structured
                profile. You can edit anything after.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/80 bg-card/60 px-4 py-2.5 text-sm transition hover:border-primary/50">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="max-w-[220px] truncate">
                    {file ? file.name : "Choose a PDF…"}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
                {file && (
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Clear file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <Button
                  onClick={upload}
                  disabled={!file}
                  className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                >
                  <Sparkles className="mr-2 h-4 w-4" /> Analyze
                </Button>
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="relative rounded-xl border border-border/70 bg-secondary/30 p-6">
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  What we extract
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {[
                    "Skills",
                    "Frameworks",
                    "Languages",
                    "Projects",
                    "Experience",
                    "Education",
                    "Strength areas",
                    "Interview angles",
                  ].map((x) => (
                    <li key={x} className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-primary" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Surface>

      {/* Profile display */}
      {loading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : profile ? (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-display text-xl font-semibold">Parsed profile</h2>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveEdit}
                    className="bg-gradient-primary text-primary-foreground"
                  >
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraft(JSON.stringify(profile.parsed, null, 2));
                    setEditing(true);
                  }}
                >
                  Edit JSON
                </Button>
              )}
            </div>
          </div>

          {editing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={24}
              className="font-mono text-xs"
            />
          ) : (
            <>
              {profile.parsed.summary && (
                <Surface className="p-6">
                  <SectionEyebrow>Summary</SectionEyebrow>
                  <p className="mt-3 text-[15px] leading-relaxed">{profile.parsed.summary}</p>
                </Surface>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <TagCard
                  icon={<Wrench className="h-4 w-4" />}
                  title="Skills"
                  items={profile.parsed.skills}
                />
                <TagCard
                  icon={<Layers className="h-4 w-4" />}
                  title="Frameworks"
                  items={profile.parsed.frameworks}
                />
                <TagCard
                  icon={<ScrollText className="h-4 w-4" />}
                  title="Languages"
                  items={profile.parsed.languages}
                />
                <TagCard
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Strength areas"
                  items={profile.parsed.strengthAreas}
                  tone="highlight"
                />
                <TagCard
                  icon={<Brain className="h-4 w-4" />}
                  title="Likely question areas"
                  items={profile.parsed.potentialQuestionAreas}
                  tone="primary"
                  className="md:col-span-2"
                />
              </div>

              {profile.parsed.projects && profile.parsed.projects.length > 0 && (
                <Surface className="p-6">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-lg font-semibold">Projects</h3>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {profile.parsed.projects.map((p, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/70 bg-secondary/30 p-4 transition hover:border-primary/40"
                      >
                        <p className="font-medium">{p.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                        {p.technologies?.length ? (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {p.technologies.map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px]">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        {p.possibleInterviewTopics?.length ? (
                          <div className="mt-3 border-t border-border/60 pt-2">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                              Interview angles
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {p.possibleInterviewTopics.join(" · ")}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Surface>
              )}

              {profile.parsed.experience && profile.parsed.experience.length > 0 && (
                <Surface className="p-6">
                  <h3 className="font-display text-lg font-semibold">Experience</h3>
                  <div className="mt-4 space-y-4">
                    {profile.parsed.experience.map((x, i) => (
                      <div key={i} className="relative pl-5">
                        <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
                        <span className="absolute left-[3px] top-4 h-full w-px bg-border" />
                        <p className="font-medium">
                          {x.role} <span className="text-muted-foreground">· {x.company}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{x.duration}</p>
                        {x.highlights?.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                            {x.highlights.map((h, hi) => (
                              <li key={hi}>{h}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Surface>
              )}

              {profile.parsed.education && profile.parsed.education.length > 0 && (
                <Surface className="p-6">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <h3 className="font-display text-lg font-semibold">Education</h3>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm">
                    {profile.parsed.education.map((e, i) => (
                      <li key={i}>
                        <span className="font-medium">{e.degree}</span> — {e.institution}{" "}
                        <span className="text-muted-foreground">({e.year})</span>
                      </li>
                    ))}
                  </ul>
                </Surface>
              )}
            </>
          )}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          icon={<FileText className="h-5 w-5" />}
          title="No resume yet"
          description="Upload a PDF to unlock personalized interviews. Your resume never leaves your account."
        />
      )}
    </div>
  );
}

function AnalysisProgress({ stage }: { stage: StageKey }) {
  const currentIndex = stage === "done" ? STAGES.length : STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground">
          <Brain className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Analyzing
          </p>
          <h3 className="font-display text-xl font-semibold">Building your candidate profile</h3>
        </div>
      </div>
      <ul className="mt-6 space-y-2.5">
        {STAGES.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex && stage !== "done";
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border ${done ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]" : active ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 bg-secondary/40 text-muted-foreground"}`}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <s.icon className="h-3 w-3" />
                )}
              </span>
              <span
                className={
                  active
                    ? "text-foreground"
                    : done
                      ? "text-muted-foreground line-through"
                      : "text-muted-foreground"
                }
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-xs text-muted-foreground">
        This usually takes 15-40 seconds. Please keep this tab open.
      </p>
    </div>
  );
}

function TagCard({
  icon,
  title,
  items,
  tone = "default",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  items?: string[];
  tone?: "default" | "primary" | "highlight";
  className?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <Surface className={`p-5 ${className ?? ""}`}>
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <Badge
            key={t}
            variant="secondary"
            className={
              tone === "primary"
                ? "border-primary/40 bg-primary/10 text-primary"
                : tone === "highlight"
                  ? "border-highlight/40 bg-highlight/10 text-highlight"
                  : ""
            }
          >
            {t}
          </Badge>
        ))}
      </div>
    </Surface>
  );
}
