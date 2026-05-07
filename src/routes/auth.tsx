import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Sun, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
  role: z.enum(["parent", "vendor"]).optional().default("parent"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode);
  const [role, setRole] = useState<"parent" | "vendor">(search.role);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, refreshRoles } = useAuth();

  useEffect(() => {
    if (user) navigate({ to: search.redirect ?? (role === "vendor" ? "/vendor" : "/parent") });
  }, [user]);

  const ensureRole = async (uid: string, r: "parent" | "vendor") => {
    await supabase.from("user_roles").upsert({ user_id: uid, role: r }, { onConflict: "user_id,role" });
    if (r === "vendor") {
      await supabase.from("profiles").update({
        business_name: businessName || null,
        business_location: businessLocation || null,
        full_name: businessName || null,
      }).eq("id", uid);
    } else if (fullName) {
      await supabase.from("profiles").update({ full_name: fullName }).eq("id", uid);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, intended_role: role },
          },
        });
        if (error) throw error;
        if (data.user) {
          await ensureRole(data.user.id, role);
          toast.success("Welcome to Sunbeam!");
          await refreshRoles();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        await refreshRoles();
        // detect role
        if (data.user) {
          const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
          const isVendor = (r ?? []).some((x) => x.role === "vendor");
          navigate({ to: isVendor ? "/vendor" : "/parent" });
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/auth?role=" + role,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Sign-in failed");
        return;
      }
      if (result.redirected) return;
      // session set; ensure role
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await ensureRole(data.user.id, role);
        await refreshRoles();
      }
    } catch (e: any) {
      toast.error(e.message ?? "OAuth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-meadow">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <Link to="/" className="mb-8 flex items-center gap-2 self-start">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-sun shadow-soft">
            <Sun className="h-5 w-5 text-sun-foreground" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-bold">Sunbeam</span>
        </Link>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <h1 className="font-display text-3xl font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Join Sunbeam to find or run great camps." : "Sign in to manage your kids and camps."}
          </p>

          {mode === "signup" && (
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setRole("parent")}
                className={`rounded-lg py-2 text-sm font-medium transition ${role === "parent" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
              >
                I'm a parent
              </button>
              <button
                type="button"
                onClick={() => setRole("vendor")}
                className={`rounded-lg py-2 text-sm font-medium transition ${role === "vendor" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
              >
                I'm a vendor
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && role === "parent" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            {mode === "signup" && role === "vendor" && (
              <>
                <div>
                  <Label htmlFor="biz">Camp name</Label>
                  <Input id="biz" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="loc">Location</Label>
                  <Input id="loc" required value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} placeholder="City, area code" />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2">
            <Button variant="outline" size="lg" onClick={() => oauth("google")} disabled={loading}>
              Continue with Google
            </Button>
            <Button variant="outline" size="lg" onClick={() => oauth("apple")} disabled={loading}>
              Continue with Apple
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : "New to Sunbeam? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
