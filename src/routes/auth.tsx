import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PrepPilotLogo, PrepPilotMark } from "@/components/PrepPilotLogo";
import { Surface } from "@/components/prep/primitives";
import { ArrowRight, ShieldCheck, Sparkles, LineChart } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — PrepPilot" },
      { name: "description", content: "Sign in to PrepPilot to run adaptive AI interviews and track your readiness." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setMode(search.mode ?? "signin"); }, [search.mode]);

  useEffect(() => {
    setHydrated(true);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    if (!em || !pw) { toast.error("Enter your email and password to continue."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: em, password: pw,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() || em.split("@")[0] } },
        });
        if (error) throw error;
        if (!data.session) { toast.success("Account created. Sign in to continue."); setMode("signin"); return; }
        toast.success("Welcome to PrepPilot");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (error) throw error;
        toast.success("Welcome back");
      }
      const { data: u, error: ue } = await supabase.auth.getUser();
      if (ue || !u.user) throw new Error("Your session could not be verified. Please try again.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-hero" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        {/* Left: brand story */}
        <div className="hidden flex-col justify-between lg:flex">
          <Link to="/"><PrepPilotLogo /></Link>
          <div className="max-w-md">
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight">
              A cockpit for your interview readiness.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Sign in to run an adaptive interview tailored to your resume, get scored on five dimensions,
              and watch your readiness climb across sessions.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Sparkles, title: "Resume-aware questions", body: "Every question references your actual work." },
                { icon: LineChart, title: "Measurable readiness", body: "A rolling score, not a vibe check." },
                { icon: ShieldCheck, title: "Your data, your control", body: "Private storage, session-scoped access." },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md border border-border/70 bg-card/60 text-primary">
                    <f.icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <p className="text-muted-foreground">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} PrepPilot</p>
        </div>

        {/* Right: form */}
        <div className="flex flex-col justify-center">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link to="/"><PrepPilotLogo compact /></Link>
          </div>
          <Surface elevated className="p-8 backdrop-blur-xl">
            <div className="mb-6 hidden items-center justify-center lg:flex">
              <PrepPilotMark size={36} />
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signup"
                ? "Start your first adaptive interview in minutes."
                : "Sign in to continue prepping."}
            </p>
            <form onSubmit={submit} className="mt-7 space-y-4">
              {mode === "signup" && (
                <Field label="Name" htmlFor="name">
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" disabled={!hydrated || busy} />
                </Field>
              )}
              <Field label="Email" htmlFor="email">
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@work.com" disabled={!hydrated || busy} />
              </Field>
              <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 6 characters" : undefined}>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={!hydrated || busy} />
              </Field>
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={!hydrated || busy}
                className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                {!hydrated ? "Loading…" : busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                {hydrated && !busy && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
            <button
              type="button"
              disabled={!hydrated || busy}
              onClick={() => {
                const next = mode === "signup" ? "signin" : "signup";
                setMode(next);
                navigate({ to: "/auth", search: { mode: next }, replace: true });
              }}
              className="mt-6 w-full text-center text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-60"
            >
              {mode === "signup" ? "Have an account? Sign in" : "New to PrepPilot? Create an account"}
            </button>
          </Surface>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
