import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseResume, updateCandidateProfile } from "@/lib/interview.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, Sparkles } from "lucide-react";

type Parsed = {
  summary?: string;
  skills?: string[]; frameworks?: string[]; languages?: string[];
  strengthAreas?: string[]; potentialQuestionAreas?: string[];
  education?: { degree: string; institution: string; year: string }[];
  experience?: { role: string; company: string; duration: string; highlights: string[] }[];
  projects?: { name: string; description: string; technologies: string[]; possibleInterviewTopics: string[] }[];
};

function ResumePage() {
  const [profile, setProfile] = useState<{ id: string; parsed: Parsed } | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const parseFn = useServerFn(parseResume);
  const updateFn = useServerFn(updateCandidateProfile);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("candidate_profiles")
      .select("id, parsed").eq("user_id", u.user.id).maybeSingle();
    if (data) setProfile({ id: data.id, parsed: (data.parsed as Parsed) ?? {} });
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const path = `${u.user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, {
        contentType: "application/pdf", upsert: false,
      });
      if (upErr) throw upErr;
      toast.info("Analyzing your resume…");
      await parseFn({ data: { resumePath: path } });
      toast.success("Resume parsed!");
      await load();
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
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
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <p className="text-sm text-muted-foreground">Resume Intelligence</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your candidate profile</h1>
      </div>

      <Card className="mt-6 border-border/60 bg-card/60 p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-gradient-primary text-white">
            <Upload className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-medium">Upload a PDF resume</h2>
            <p className="text-sm text-muted-foreground">PrepPilot extracts skills, projects, and interview topics.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="max-w-xs" />
          <Button disabled={!file || busy} onClick={upload} className="bg-gradient-primary text-white hover:opacity-90">
            {busy ? "Working…" : "Upload & Analyze"}
          </Button>
        </div>
      </Card>

      {profile && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Parsed Profile</h2>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button onClick={saveEdit}>Save</Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => {
                  setDraft(JSON.stringify(profile.parsed, null, 2));
                  setEditing(true);
                }}>Edit JSON</Button>
              )}
            </div>
          </div>

          {editing ? (
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={24} className="font-mono text-xs" />
          ) : (
            <>
              {profile.parsed.summary && (
                <Card className="border-border/60 bg-card/60 p-5">
                  <p className="text-sm text-muted-foreground">Summary</p>
                  <p className="mt-2">{profile.parsed.summary}</p>
                </Card>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <TagCard title="Skills" items={profile.parsed.skills} />
                <TagCard title="Frameworks" items={profile.parsed.frameworks} />
                <TagCard title="Languages" items={profile.parsed.languages} />
                <TagCard title="Strength Areas" items={profile.parsed.strengthAreas} tone="highlight" />
                <TagCard title="Likely Question Areas" items={profile.parsed.potentialQuestionAreas} tone="primary" />
              </div>

              {profile.parsed.projects && profile.parsed.projects.length > 0 && (
                <Card className="border-border/60 bg-card/60 p-5">
                  <h3 className="font-medium">Projects</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {profile.parsed.projects.map((p, i) => (
                      <div key={i} className="rounded-md border border-border/60 bg-background/40 p-4">
                        <p className="font-medium">{p.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.technologies?.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                        </div>
                        {p.possibleInterviewTopics?.length ? (
                          <p className="mt-3 text-xs text-muted-foreground">Interview angles: {p.possibleInterviewTopics.join(" · ")}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {profile.parsed.experience && profile.parsed.experience.length > 0 && (
                <Card className="border-border/60 bg-card/60 p-5">
                  <h3 className="font-medium">Experience</h3>
                  <div className="mt-3 space-y-3">
                    {profile.parsed.experience.map((x, i) => (
                      <div key={i} className="border-l-2 border-primary/50 pl-4">
                        <p className="font-medium">{x.role} · {x.company}</p>
                        <p className="text-xs text-muted-foreground">{x.duration}</p>
                        {x.highlights?.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                            {x.highlights.map((h, hi) => <li key={hi}>{h}</li>)}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {profile.parsed.education && profile.parsed.education.length > 0 && (
                <Card className="border-border/60 bg-card/60 p-5">
                  <h3 className="font-medium">Education</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {profile.parsed.education.map((e, i) => (
                      <li key={i}><span className="font-medium">{e.degree}</span> — {e.institution} <span className="text-muted-foreground">({e.year})</span></li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {!profile && (
        <Card className="mt-6 flex flex-col items-center gap-2 border-dashed border-border/60 bg-card/40 p-10 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No resume yet. Upload one to get personalized interviews.</p>
        </Card>
      )}
    </div>
  );
}

function TagCard({ title, items, tone = "default" }: { title: string; items?: string[]; tone?: "default" | "primary" | "highlight" }) {
  if (!items || items.length === 0) return null;
  return (
    <Card className="border-border/60 bg-card/60 p-5">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <Badge key={t} variant="secondary"
            className={
              tone === "primary" ? "border-primary/40 bg-primary/10 text-primary" :
              tone === "highlight" ? "border-highlight/40 bg-highlight/10 text-highlight" :
              ""
            }>{t}</Badge>
        ))}
      </div>
    </Card>
  );
}
