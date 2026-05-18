import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Calendar, ExternalLink, Users, Search, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

type Session = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  postal_code: string | null;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  available_spots: number | null;
  price_cents: number | null;
  age_min: number | null;
  age_max: number | null;
  registration_url: string | null;
  image_url: string | null;
  day_type: string | null;
  source: string | null;
  capacity_known: boolean | null;
};

type DayType = "half_day" | "full_day" | "multi_week";

export const Route = createFileRoute("/sessions")({
  component: SessionsPage,
});

// Generate Mon-Fri summer weeks 2026
function summerWeeks(): { label: string; start: string; end: string }[] {
  const weeks: { label: string; start: string; end: string }[] = [];
  // Start first Monday in June 2026
  let d = new Date("2026-06-01T00:00:00");
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  for (let i = 0; i < 12; i++) {
    const start = new Date(d);
    const end = new Date(d); end.setDate(end.getDate() + 4);
    const iso = (dt: Date) => dt.toISOString().slice(0, 10);
    weeks.push({
      start: iso(start),
      end: iso(end),
      label: `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    });
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

function SessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaCode, setAreaCode] = useState("");
  const [ageRange, setAgeRange] = useState<[number, number]>([5, 18]);
  const [dayTypes, setDayTypes] = useState<Set<DayType>>(new Set());
  const [selectedWeeks, setSelectedWeeks] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const weeks = useMemo(summerWeeks, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("camp_sessions")
      .select("*")
      .eq("is_published", true)
      .order("start_date", { ascending: true });
    setSessions((data ?? []) as Session[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      // area
      if (areaCode.trim()) {
        const a = areaCode.trim().toLowerCase();
        const hit = (s.postal_code ?? "").toLowerCase().startsWith(a) || (s.location ?? "").toLowerCase().includes(a);
        if (!hit) return false;
      }
      // age overlap with [ageRange]
      const lo = s.age_min ?? 0;
      const hi = s.age_max ?? 99;
      if (hi < ageRange[0] || lo > ageRange[1]) return false;
      // day type
      if (dayTypes.size && !dayTypes.has((s.day_type as DayType) ?? "full_day")) return false;
      // weeks: session overlaps any selected week
      if (selectedWeeks.size) {
        const sStart = new Date(s.start_date).getTime();
        const sEnd = new Date(s.end_date).getTime();
        const overlaps = Array.from(selectedWeeks).some((wkStart) => {
          const wk = weeks.find((w) => w.start === wkStart);
          if (!wk) return false;
          const wStart = new Date(wk.start).getTime();
          const wEnd = new Date(wk.end).getTime();
          return sStart <= wEnd && sEnd >= wStart;
        });
        if (!overlaps) return false;
      }
      return true;
    });
  }, [sessions, areaCode, ageRange, dayTypes, selectedWeeks, weeks]);

  return (
    <div className="min-h-screen bg-gradient-meadow">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Browse summer camps</h1>
            <p className="mt-2 text-muted-foreground">Find the perfect adventure for your kid.</p>
          </div>
          <div className="flex gap-2">
            {user && (
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add a camp
              </Button>
            )}
            {!user && (
              <Link to="/auth" search={{ mode: "signup", role: "parent" } as never}>
                <Button variant="hero">Sign up to register</Button>
              </Link>
            )}
          </div>
        </header>

        {/* Filters */}
        <div className="mb-6 grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Search className="h-3.5 w-3.5" /> Area / postal</Label>
            <Input value={areaCode} onChange={(e) => setAreaCode(e.target.value)} placeholder="e.g. Bloomington or 47401" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ages {ageRange[0]}–{ageRange[1]}</Label>
            <Slider
              min={3} max={18} step={1}
              value={ageRange as number[]}
              onValueChange={(v) => setAgeRange([v[0], v[1]] as [number, number])}
              className="pt-3"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Length</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {([
                ["half_day", "Half-day"],
                ["full_day", "Full day"],
                ["multi_week", "Multi-week"],
              ] as [DayType, string][]).map(([k, label]) => {
                const active = dayTypes.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      const next = new Set(dayTypes);
                      if (active) next.delete(k); else next.add(k);
                      setDayTypes(next);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Weeks</Label>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {weeks.map((w) => {
                const active = selectedWeeks.has(w.start);
                return (
                  <button
                    key={w.start}
                    type="button"
                    onClick={() => {
                      const next = new Set(selectedWeeks);
                      if (active) next.delete(w.start); else next.add(w.start);
                      setSelectedWeeks(next);
                    }}
                    className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent"}`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No camps match those filters.</p>
            {user && (
              <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add a camp you know about
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <SessionCard key={s.id} s={s} canRegister={!!user} />
            ))}
          </div>
        )}

        {user && (
          <AddCampDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            existingSessions={sessions}
            onAdded={(newId) => { setAddOpen(false); load(); toast.success("Camp added!"); void newId; }}
          />
        )}
      </main>
    </div>
  );
}

function SessionCard({ s, canRegister }: { s: Session; canRegister: boolean }) {
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const isCommunity = s.source === "community";
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="aspect-[16/10] bg-gradient-sun" style={s.image_url ? { backgroundImage: `url(${s.image_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl font-semibold">{s.title}</h3>
          {isCommunity && (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">Community</span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {fmt(s.start_date)} — {fmt(s.end_date)}</li>
          {(s.location || s.postal_code) && <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {[s.location, s.postal_code].filter(Boolean).join(" · ")}</li>}
          {(s.age_min || s.age_max) && (
            <li className="flex items-center gap-2"><Users className="h-4 w-4" /> Ages {s.age_min ?? "?"}–{s.age_max ?? "?"}</li>
          )}
          {s.capacity_known === false ? (
            <li className="italic text-muted-foreground/80">Capacity unknown</li>
          ) : s.available_spots != null ? (
            <li>{s.available_spots} spots available</li>
          ) : null}
          {s.registration_deadline && <li>Register by {new Date(s.registration_deadline).toLocaleDateString()}</li>}
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

function AddCampDialog({
  open, onOpenChange, existingSessions, onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingSessions: Session[];
  onAdded: (newId: string) => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<"search" | "create">("search");
  const [title, setTitle] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [form, setForm] = useState({
    description: "", location: "", postal_code: "Bloomington, IN",
    start_date: "", end_date: "",
    age_min: "5", age_max: "12",
    price: "",
    day_type: "full_day" as DayType,
    registration_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("search"); setTitle(""); setConfirmed(false);
      setForm({ description: "", location: "", postal_code: "Bloomington, IN", start_date: "", end_date: "", age_min: "5", age_max: "12", price: "", day_type: "full_day", registration_url: "" });
    }
  }, [open]);

  // Show camps with overlapping name tokens
  const matches = useMemo(() => {
    const q = title.trim().toLowerCase();
    if (q.length < 2) return [];
    const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
    return existingSessions
      .map((s) => {
        const t = s.title.toLowerCase();
        const score = tokens.reduce((acc, tok) => acc + (t.includes(tok) ? 1 : 0), 0);
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.s);
  }, [title, existingSessions]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload: any = {
      vendor_id: user.id,
      created_by: user.id,
      source: "community",
      capacity_known: false,
      title,
      description: form.description || null,
      location: form.location || null,
      postal_code: form.postal_code || null,
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      age_min: form.age_min ? Number(form.age_min) : null,
      age_max: form.age_max ? Number(form.age_max) : null,
      price_cents: form.price ? Math.round(Number(form.price) * 100) : null,
      day_type: form.day_type,
      registration_url: form.registration_url || null,
      is_published: true,
    };
    const { data, error } = await supabase.from("camp_sessions").insert(payload).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    onAdded(data?.id ?? "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Add a camp</DialogTitle>
          <DialogDescription>
            {step === "search" ? "Search first — your camp may already be listed." : "Add details. Capacity will be marked unknown until a vendor or admin updates it."}
          </DialogDescription>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4">
            <div>
              <Label>Camp name</Label>
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. YMCA Adventure Week" />
            </div>
            {title.length >= 2 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  {matches.length ? "Similar camps already listed:" : "No similar camps found."}
                </p>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-muted/30 p-2">
                  {matches.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Nothing matched. You can add it as a new camp below.</p>
                  ) : (
                    matches.map((s) => (
                      <Link key={s.id} to="/parent" search={{ session: s.id } as never} className="block rounded-lg p-2 text-sm hover:bg-background">
                        <p className="font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(s.start_date).toLocaleDateString()} – {new Date(s.end_date).toLocaleDateString()}{s.location ? ` · ${s.location}` : ""}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
              <span>I checked the matches above — my camp isn't listed yet.</span>
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="hero" disabled={title.trim().length < 2 || !confirmed} onClick={() => setStep("create")}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="YMCA Bloomington" /></div>
              <div><Label>Area / city</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts</Label><Input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Ends</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Age min</Label><Input type="number" value={form.age_min} onChange={(e) => setForm({ ...form, age_min: e.target.value })} /></div>
              <div><Label>Age max</Label><Input type="number" value={form.age_max} onChange={(e) => setForm({ ...form, age_max: e.target.value })} /></div>
              <div><Label>Price ($)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            </div>
            <div>
              <Label>Length</Label>
              <div className="mt-1 flex gap-2">
                {([
                  ["half_day", "Half-day"],
                  ["full_day", "Full day"],
                  ["multi_week", "Multi-week"],
                ] as [DayType, string][]).map(([k, label]) => (
                  <button key={k} type="button"
                    onClick={() => setForm({ ...form, day_type: k })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${form.day_type === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Registration link (optional)</Label><Input type="url" value={form.registration_url} onChange={(e) => setForm({ ...form, registration_url: e.target.value })} /></div>
            <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
              Since you're not the vendor, this camp will be tagged "Community" with capacity unknown. An admin or the vendor can fill in capacity later.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("search")}>Back</Button>
              <Button type="submit" variant="hero" disabled={saving}>{saving ? "Adding…" : "Add camp"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
