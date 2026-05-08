import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function RequireAuth({ children, role }: { children: ReactNode; role?: "parent" | "vendor" }) {
  const { user, loading, rolesLoading, roles } = useAuth();
  if (loading || (user && rolesLoading)) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  if (role && !roles.includes(role)) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Wrong dashboard</h1>
        <p className="mt-2 text-muted-foreground">Your account isn't a {role} account.</p>
      </div>
    );
  }
  return <>{children}</>;
}
