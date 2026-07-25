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
import { cn } from "@/lib/utils";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });
const strongPasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/\d/, "Add a number.")
  .regex(/[^A-Za-z0-9]/, "Add a symbol.");

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — PrepPilot" },
      {
        name: "description",
        content: "Sign in to PrepPilot to run adaptive AI interviews and track your readiness.",
      },
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    setMode(search.mode ?? "signin");
  }, [search.mode]);

  useEffect(() => {
    setHydrated(true);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const em = email.trim().toLowerCase();
    const pw = password;
    setFeedback(null);
    if (!z.string().email().safeParse(em).success) {
      setFeedback({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    if (!pw) {
      setFeedback({ kind: "error", message: "Enter your password." });
      return;
    }
    if (mode === "signup") {
      const passwordResult = strongPasswordSchema.safeParse(pw);
      if (!passwordResult.success) {
        setFeedback({ kind: "error", message: passwordResult.error.issues[0].message });
        return;
      }
      if (pw !== confirmPassword) {
        setFeedback({ kind: "error", message: "The passwords do not match." });
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const redirectUrl = new URL("/auth", window.location.origin);
        redirectUrl.searchParams.set("mode", "signin");
        const { data, error } = await supabase.auth.signUp({
          email: em,
          password: pw,
          options: {
            emailRedirectTo: redirectUrl.toString(),
            data: { display_name: name.trim() || em.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.user?.identities?.length === 0) {
          const message =
            "If this address is eligible for registration, a confirmation email will arrive shortly.";
          setFeedback({ kind: "success", message });
          setPassword("");
          setConfirmPassword("");
          return;
        }
        if (!data.session) {
          const message = `Account created. Check ${em} for the confirmation link before signing in.`;
          setFeedback({ kind: "success", message });
          toast.success("Check your email to confirm your account.");
          setPassword("");
          setConfirmPassword("");
          return;
        }
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
      const message = err instanceof Error ? err.message : "Authentication failed.";
      const normalizedMessage = /rate limit/i.test(message)
        ? "Too many registration emails were requested. Wait a few minutes and try again."
        : /signups? (?:are )?disabled/i.test(message)
          ? "New account registration is currently disabled in Supabase authentication settings."
          : message;
      setFeedback({ kind: "error", message: normalizedMessage });
      toast.error(normalizedMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-hero" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        {/* Left: brand story */}
        <div className="hidden flex-col justify-between lg:flex">
          <Link to="/">
            <PrepPilotLogo />
          </Link>
          <div className="max-w-md">
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight">
              A cockpit for your interview readiness.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Sign in to run an adaptive interview tailored to your resume, get scored on five
              dimensions, and watch your readiness climb across sessions.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                {
                  icon: Sparkles,
                  title: "Resume-aware questions",
                  body: "Every question references your actual work.",
                },
                {
                  icon: LineChart,
                  title: "Measurable readiness",
                  body: "A rolling score, not a vibe check.",
                },
                {
                  icon: ShieldCheck,
                  title: "Your data, your control",
                  body: "Private storage, session-scoped access.",
                },
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
            <Link to="/">
              <PrepPilotLogo compact />
            </Link>
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
                  <Input
                    id="name"
                    autoComplete="name"
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    disabled={!hydrated || busy}
                  />
                </Field>
              )}
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@work.com"
                  disabled={!hydrated || busy}
                />
              </Field>
              <Field
                label="Password"
                htmlFor="password"
                hint={mode === "signup" ? "10+ characters" : undefined}
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "signup" ? 10 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={!hydrated || busy}
                />
              </Field>
              {mode === "signup" && (
                <>
                  <Field label="Confirm password" htmlFor="confirm-password">
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={10}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••"
                      disabled={!hydrated || busy}
                    />
                  </Field>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Use uppercase and lowercase letters, a number, and a symbol. Avoid passwords
                    used on other sites.
                  </p>
                </>
              )}
              <Button
                type="submit"
                disabled={!hydrated || busy}
                className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                {!hydrated
                  ? "Loading…"
                  : busy
                    ? "Please wait…"
                    : mode === "signup"
                      ? "Create account"
                      : "Sign in"}
                {hydrated && !busy && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
            {feedback && (
              <div
                className={cn(
                  "mt-4 rounded-lg border px-4 py-3 text-sm",
                  feedback.kind === "success"
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
                role={feedback.kind === "error" ? "alert" : "status"}
              >
                {feedback.message}
              </div>
            )}
            <button
              type="button"
              disabled={!hydrated || busy}
              onClick={() => {
                const next = mode === "signup" ? "signin" : "signup";
                setMode(next);
                setFeedback(null);
                setPassword("");
                setConfirmPassword("");
                navigate({ to: "/auth", search: { mode: next }, replace: true });
              }}
              className="mt-6 w-full text-center text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-60"
            >
              {mode === "signup"
                ? "Have an account? Sign in"
                : "New to PrepPilot? Create an account"}
            </button>
          </Surface>
          <p className="mt-6 text-center text-[11px] text-muted-foreground/80">
            Built by Divyam Madan &amp; Suhani Mahajan
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label
          htmlFor={htmlFor}
          className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
        >
          {label}
        </Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
