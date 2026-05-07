import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Calendar, ExternalLink, Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Session = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  postal_code: string | null;
  start_date: string;
  end_date: string;
  price_cents: number | null;
  age_min: number | null;
  age_max: number | null;
  registration_url: string | null;
  image_url: string | null;
};

export const Route = createFileRoute("/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaCode, setAreaCode] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("camp_sessions")
        .select("*")
        .eq("is_published", true)
        .order("start_date", { ascending: true });
      setSessions((data ?? []) as Session[]);
      setLoading(false);
    })();
  }, []);

  const filtered = areaCode.trim()
    ? sessions.filter((s) =>
        (s.postal_code ?? "").toLowerCase().startsWith(areaCode.trim().toLowerCase()) ||
        (s.location ?? "").toLowerCase().includes(areaCode.trim().toLowerCase()),
      )
    : sessions;

  return (
    <div className="min-h-screen bg-gradient-meadow">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Browse summer camps</h1>
            <p className="mt-2 text-muted-foreground">Find the perfect adventure for your kid.</p>
          </div>
          {!user && (
            <Link to="/auth" search={{ mode: "signup", role: "parent" } as never}>
              <Button variant="hero">Sign up to register</Button>
            </Link>
          )}
        </header>

        <div className="mb-6 flex max-w-md items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1.5 shadow-soft">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value)}
            placeholder="Search by area / postal code"
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">{areaCode ? "No camps match that area code." : "No camps published yet — check back soon!"}</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <SessionCard key={s.id} s={s} canRegister={!!user} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SessionCard({ s, canRegister }: { s: Session; canRegister: boolean }) {
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="aspect-[16/10] bg-gradient-sun" style={s.image_url ? { backgroundImage: `url(${s.image_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-semibold">{s.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {fmt(s.start_date)} — {fmt(s.end_date)}</li>
          {(s.location || s.postal_code) && <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {[s.location, s.postal_code].filter(Boolean).join(" · ")}</li>}
          {(s.age_min || s.age_max) && (
            <li className="flex items-center gap-2"><Users className="h-4 w-4" /> Ages {s.age_min ?? "?"}–{s.age_max ?? "?"}</li>
          )}
        </ul>
        <div className="mt-5 flex items-center justify-between">
          <div className="font-display text-lg font-semibold">
            {s.price_cents != null ? `$${(s.price_cents / 100).toFixed(0)}` : "Free"}
          </div>
          {canRegister ? (
            <Link to="/parent" search={{ session: s.id } as never}>
              <Button size="sm" variant="hero">Register</Button>
            </Link>
          ) : s.registration_url ? (
            <a href={s.registration_url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">Visit <ExternalLink className="h-3.5 w-3.5" /></Button>
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
