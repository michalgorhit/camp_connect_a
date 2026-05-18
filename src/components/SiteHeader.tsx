import { Link, useNavigate } from "@tanstack/react-router";
import { Sun, LogOut, Tent, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const isVendor = roles.includes("vendor");
  const isAdmin = roles.includes("admin");
  const dashHref = isAdmin ? "/admin" : isVendor ? "/vendor" : "/parent";

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-sun shadow-soft">
            <Sun className="h-5 w-5 text-sun-foreground" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Summer Buddy Connect</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link to="/sessions" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            Browse camps
          </Link>
          {user && (
            <Link to={dashHref} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className="rounded-lg px-3 py-2 text-sm font-medium text-primary hover:text-primary">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="sm">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
              <Link to={dashHref}>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Tent className="h-4 w-4" />
                  My camps
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link to="/auth" search={{ mode: "signup" } as never}>
                <Button variant="hero" size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
