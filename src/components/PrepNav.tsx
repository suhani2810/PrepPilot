import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PrepPilotLogo } from "@/components/PrepPilotLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PrepNav({ authed }: { authed: boolean }) {
  const router = useRouter();
  const signOut = async () => {
    await supabase.auth.signOut();
    router.invalidate();
    router.navigate({ to: "/" });
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link to="/" className="transition-opacity hover:opacity-85">
          <PrepPilotLogo />
        </Link>
        <nav className="flex items-center gap-1.5">
          {authed ? (
            <>
              <Link to="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>
              <Link to="/resume"><Button variant="ghost" size="sm">Resume</Button></Link>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
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
