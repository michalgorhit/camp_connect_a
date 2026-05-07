import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Calendar, MapPin, Users, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/SiteHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/vendor")({
  component: () => (
    <RequireAuth role="vendor">
      <VendorDashboard />
    </RequireAuth>
  ),
});

type Sess = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  price_cents: number | null;
  age_min: number | null;
  age_max: number | null;
  capacity: number | null;
  registration_url: string | null;
  is_published: boolean;
};

function VendorDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sess | null>(null);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("camp_sessions")
      .select("*")
      .eq("vendor_id", user.id)
      .order("start_date", { ascending: true });
    setSessions((data ?? []) as Sess[]);

    const ids = (data ?? []).map((s) => s.id);
    if (ids.length) {
      const { data: regs } = await supabase
        .from("registrations")
        .select("session_id")
        .in("session_id", ids);
      const counts: Record<string, number> = {};
      (regs ?? []).forEach((r) => { counts[r.session_id] = (counts[r.session_id] ?? 0) + 1; });
      setRegCounts(counts);
    }
  };

  useEffect(() => { load(); }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Delete this session?")) return;
    const { error } = await supabase.from("camp_sessions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Session deleted");
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-meadow">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Vendor dashboard</h1>
            <p className="mt-2 text-muted-foreground">Publish and manage your camp sessions.</p>
          </div>
          <Button variant="hero" size="lg" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-5 w-5" /> New session
          </Button>
        </header>

        {sessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <h2 className="font-display text-xl">No sessions yet</h2>
            <p className="mt-2 text-muted-foreground">Add your first camp session to get discovered.</p>
            <Button variant="hero" className="mt-5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create session</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((s) => (
              <article key={s.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {new Date(s.start_date).toLocaleDateString()} – {new Date(s.end_date).toLocaleDateString()}</span>
                    {s.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {s.location}</span>}
                    <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {regCounts[s.id] ?? 0} interested</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(s); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <SessionDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => { setOpen(false); load(); }} />
      </main>
    </div>
  );
}

function SessionDialog({
  open, onOpenChange, editing, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: Sess | null; onSaved: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "", description: "", location: "", postal_code: "",
    start_date: "", end_date: "",
    price: "", age_min: "", age_max: "", capacity: "",
    registration_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description ?? "",
        location: editing.location ?? "",
        postal_code: (editing as any).postal_code ?? "",
        start_date: editing.start_date,
        end_date: editing.end_date,
        price: editing.price_cents != null ? (editing.price_cents / 100).toString() : "",
        age_min: editing.age_min?.toString() ?? "",
        age_max: editing.age_max?.toString() ?? "",
        capacity: editing.capacity?.toString() ?? "",
        registration_url: editing.registration_url ?? "",
      });
    } else {
      setForm({ title: "", description: "", location: "", postal_code: "", start_date: "", end_date: "", price: "", age_min: "", age_max: "", capacity: "", registration_url: "" });
    }
  }, [editing, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      vendor_id: user.id,
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      postal_code: form.postal_code || null,
      start_date: form.start_date,
      end_date: form.end_date,
      price_cents: form.price ? Math.round(Number(form.price) * 100) : null,
      age_min: form.age_min ? Number(form.age_min) : null,
      age_max: form.age_max ? Number(form.age_max) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      registration_url: form.registration_url || null,
    };
    const { error } = editing
      ? await supabase.from("camp_sessions").update(payload).eq("id", editing.id)
      : await supabase.from("camp_sessions").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Updated!" : "Session created!");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{editing ? "Edit session" : "New session"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Starts</Label><Input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>Ends</Label><Input type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Price ($)</Label><Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div><Label>Age min</Label><Input type="number" value={form.age_min} onChange={(e) => setForm({ ...form, age_min: e.target.value })} /></div>
            <div><Label>Age max</Label><Input type="number" value={form.age_max} onChange={(e) => setForm({ ...form, age_max: e.target.value })} /></div>
          </div>
          <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
          <div>
            <Label>Registration URL (your site)</Label>
            <Input type="url" placeholder="https://yourcamp.com/register" value={form.registration_url} onChange={(e) => setForm({ ...form, registration_url: e.target.value })} />
            <p className="mt-1 text-xs text-muted-foreground">Parents click through to register on your site.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Publish"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
