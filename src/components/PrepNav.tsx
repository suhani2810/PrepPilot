import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PrepPilotLogo } from "@/components/PrepPilotLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/resume", label: "Resume" },
  { to: "/history", label: "History" },
] as const;

export function PrepNav({ authed }: { authed: boolean }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const signOut = async () => {
    await supabase.auth.signOut();
    router.invalidate();
    router.navigate({ to: "/" });
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="transition-opacity hover:opacity-85">
          <PrepPilotLogo />
        </Link>
        <nav className="flex items-center gap-1">
          {authed && (
            <div className="hidden items-center gap-0.5 rounded-full border border-border/60 bg-card/60 p-0.5 sm:flex">
              {NAV_LINKS.map((l) => {
                const active = pathname === l.to || (l.to !== "/dashboard" && pathname.startsWith(l.to));
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                      active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          )}
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <ThemeToggle />
          {authed ? (
            <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
          ) : (
            <>
              <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90">
                  Get started
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
