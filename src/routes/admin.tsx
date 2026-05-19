import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Users, Tent, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SessionDialog } from "@/components/SessionDialog";

type Sess = {
  id: string;
  title: string;
  vendor_id: string;
  start_date: string;
  end_date: string;
  location: string | null;
  capacity: number | null;
  available_spots: number | null;
  source: string | null;
  day_type: string | null;
  age_min: number | null;
  age_max: number | null;
  capacity_known: boolean | null;
  is_published: boolean;
};

type Profile = { id: string; full_name: string | null; business_name: string | null };

export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireAuth role="admin">
      <AdminDashboard />
    </RequireAuth>
  ),
});

function AdminDashboard() {
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [counts, setCounts] = useState<Record<string, { interested: number; registered: number }>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const { data: s } = await supabase.from("camp_sessions").select("*").order("start_date");
    setSessions((s ?? []) as Sess[]);

    const { data: regs } = await supabase.from("registrations").select("session_id,status");
    const c: Record<string, { interested: number; registered: number }> = {};
    (regs ?? []).forEach((r: any) => {
      const x = c[r.session_id] ?? { interested: 0, registered: 0 };
      if (r.status === "registered") x.registered++; else x.interested++;
      c[r.session_id] = x;
    });
    setCounts(c);

    // Vendor profiles = anyone with vendor role
    const { data: vroles } = await supabase.from("user_roles").select("user_id").eq("role", "vendor");
    const ids = (vroles ?? []).map((r: any) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, business_name").in("id", ids);
      setVendors((profs ?? []) as Profile[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return sessions;
    const t = q.trim().toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(t) || (s.location ?? "").toLowerCase().includes(t));
  }, [q, sessions]);

  const totals = useMemo(() => {
    let interested = 0, registered = 0;
    Object.values(counts).forEach((c) => { interested += c.interested; registered += c.registered; });
    return { camps: sessions.length, interested, registered };
  }, [counts, sessions]);

  const assignVendor = async (sessId: string, vendorId: string) => {
    const { error } = await supabase.from("camp_sessions").update({ vendor_id: vendorId, source: "vendor" }).eq("id", sessId);
    if (error) return toast.error(error.message);
    toast.success("Vendor assigned");
    load();
  };

  const setSpots = async (sessId: string, value: string) => {
    const n = value === "" ? null : Number(value);
    const payload: any = { available_spots: n };
    if (n != null) payload.capacity_known = true;
    const { error } = await supabase.from("camp_sessions").update(payload).eq("id", sessId);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this camp?")) return;
    const { error } = await supabase.from("camp_sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-meadow">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Admin</h1>
            <p className="mt-2 text-muted-foreground">Full picture across every camp.</p>
          </div>
          <Button variant="hero" size="lg" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-5 w-5" /> New session
          </Button>
        </header>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Camps" value={totals.camps} icon={<Tent className="h-4 w-4" />} />
          <Stat label="Registered" value={totals.registered} icon={<Users className="h-4 w-4" />} />
          <Stat label="Interested" value={totals.interested} icon={<Users className="h-4 w-4" />} />
        </div>

        <div className="mb-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or location" className="max-w-md" />
        </div>

        {loading ? <p className="text-muted-foreground">Loading…</p> : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Camp</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Reg / Int</th>
                  <th className="px-4 py-3">Spots left</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const c = counts[s.id] ?? { interested: 0, registered: 0 };
                  const vendor = vendors.find((v) => v.id === s.vendor_id);
                  return (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="px-4 py-3">
                        <div className="font-medium">{s.title}</div>
                        <div className="text-xs text-muted-foreground">{s.location ?? "—"} · Ages {s.age_min ?? "?"}–{s.age_max ?? "?"} · {s.day_type}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(s.start_date).toLocaleDateString()}<br />
                        <span className="text-xs">→ {new Date(s.end_date).toLocaleDateString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${s.source === "community" ? "bg-accent text-accent-foreground" : s.source === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {s.source ?? "vendor"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Select value={s.vendor_id} onValueChange={(v) => assignVendor(s.id, v)}>
                          <SelectTrigger className="h-8 w-44 text-xs">
                            <SelectValue placeholder={vendor?.business_name ?? vendor?.full_name ?? "Assign vendor"} />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map((v) => (
                              <SelectItem key={v.id} value={v.id}>{v.business_name ?? v.full_name ?? v.id.slice(0, 8)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <span className="text-primary">{c.registered}</span> / {c.interested}
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          defaultValue={s.available_spots ?? ""}
                          placeholder={s.capacity_known === false ? "unknown" : "—"}
                          onBlur={(e) => setSpots(s.id, e.target.value)}
                          className="h-8 w-20 text-xs"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <SessionDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => { setOpen(false); load(); }} />
      </main>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 font-display text-3xl font-bold">{value}</div>
    </div>
  );
}
