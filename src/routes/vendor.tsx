import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import Papa from "papaparse";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Calendar,
  MapPin,
  Users,
  Trash2,
  Edit,
  Sparkles,
  Loader2,
  Download,
  Upload,
} from "lucide-react";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { importCampsFromUrl } from "@/lib/import-camps.functions";
import { SessionDialog } from "@/components/SessionDialog";

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
  postal_code: string | null;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  available_spots: number | null;
  price_cents: number | null;
  age_min: number | null;
  age_max: number | null;
  capacity: number | null;
  registration_url: string | null;
  source_url: string | null;
  is_published: boolean;
};

function VendorDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Sess | null>(null);
  const [regCounts, setRegCounts] = useState<
    Record<string, { interested: number; registered: number }>
  >({});

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
        .select("session_id,status")
        .in("session_id", ids);
      const counts: Record<string, { interested: number; registered: number }> = {};
      (regs ?? []).forEach((r) => {
        const c = counts[r.session_id] ?? { interested: 0, registered: 0 };
        if (r.status === "registered") c.registered += 1;
        else c.interested += 1;
        counts[r.session_id] = c;
      });
      setRegCounts(counts);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    if (sessions.length === 0) return toast.error("No sessions to export.");
    const data = sessions.map((s) => ({
      Title: s.title,
      Description: s.description || "",
      Location: s.location || "",
      "Postal Code": s.postal_code || "",
      "Start Date": s.start_date,
      "End Date": s.end_date,
      "Registration Deadline": s.registration_deadline || "",
      Price: s.price_cents ? (s.price_cents / 100).toFixed(2) : "",
      "Age Min": s.age_min || "",
      "Age Max": s.age_max || "",
      Capacity: s.capacity || "",
      "Available Spots": s.available_spots || "",
      "Registration URL": s.registration_url || "",
      "Day Type": (s as any).day_type || "full_day",
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "camps.csv");
    a.click();
  };

  const importCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        if (rows.length === 0) return toast.error("CSV is empty");

        const payload = rows.map((r) => ({
          vendor_id: user.id,
          created_by: user.id,
          source: "vendor",
          capacity_known: true,
          title: r["Title"] || "Untitled",
          description: r["Description"] || null,
          location: r["Location"] || null,
          postal_code: r["Postal Code"] || null,
          start_date: r["Start Date"] || new Date().toISOString().split("T")[0],
          end_date: r["End Date"] || r["Start Date"] || new Date().toISOString().split("T")[0],
          registration_deadline: r["Registration Deadline"] || null,
          price_cents: r["Price"] ? Math.round(Number(r["Price"]) * 100) : null,
          age_min: r["Age Min"] ? Number(r["Age Min"]) : null,
          age_max: r["Age Max"] ? Number(r["Age Max"]) : null,
          capacity: r["Capacity"] ? Number(r["Capacity"]) : null,
          available_spots: r["Available Spots"] ? Number(r["Available Spots"]) : null,
          registration_url: r["Registration URL"] || null,
          day_type: r["Day Type"] || "full_day",
        }));

        const { error } = await supabase.from("camp_sessions").insert(payload);
        if (error) {
          toast.error("Failed to import: " + error.message);
        } else {
          toast.success(`Imported ${payload.length} sessions successfully!`);
          load();
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      error: (err) => {
        toast.error("Error reading CSV: " + err.message);
      },
    });
  };

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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={importCsv}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Import CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Sparkles className="mr-1 h-4 w-4" /> Import from website
            </Button>
            <Button
              variant="hero"
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> New session
            </Button>
          </div>
        </header>

        {sessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <h2 className="font-display text-xl">No sessions yet</h2>
            <p className="mt-2 text-muted-foreground">
              Add a session manually or paste your camp website URL to auto-import.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Sparkles className="h-4 w-4" /> Import from website
              </Button>
              <Button variant="hero" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Create session
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((s) => (
              <article
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" /> {new Date(s.start_date).toLocaleDateString()}{" "}
                      – {new Date(s.end_date).toLocaleDateString()}
                    </span>
                    {s.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" /> {s.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" /> {regCounts[s.id]?.registered ?? 0} registered ·{" "}
                      {regCounts[s.id]?.interested ?? 0} interested
                    </span>
                    {s.available_spots != null && <span>{s.available_spots} spots left</span>}
                    {s.registration_deadline && (
                      <span>
                        Register by {new Date(s.registration_deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(s);
                      setOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <SessionDialog
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          onSaved={() => {
            setOpen(false);
            load();
          }}
        />
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => {
            setImportOpen(false);
            load();
          }}
        />
      </main>
    </div>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const { user } = useAuth();
  const importFn = useServerFn(importCampsFromUrl);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) {
      setUrl("");
      setPreview(null);
      setSelected(new Set());
    }
  }, [open]);

  const extract = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await importFn({ data: { url } });
      const list = res.sessions ?? [];
      if (list.length === 0) {
        toast.error("No camp sessions found on that page.");
      } else {
        setPreview(list);
        setSelected(new Set(list.map((_: any, i: number) => i)));
      }
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!user || !preview) return;
    const today = new Date().toISOString().slice(0, 10);
    const rows = Array.from(selected).map((i) => {
      const s = preview[i];
      return {
        vendor_id: user.id,
        title: s.title,
        description: s.description ?? null,
        location: s.location ?? null,
        postal_code: s.postal_code ?? null,
        start_date: s.start_date || today,
        end_date: s.end_date || s.start_date || today,
        registration_deadline: s.registration_deadline ?? null,
        available_spots: s.available_spots ?? null,
        price_cents: s.price != null ? Math.round(s.price * 100) : null,
        age_min: s.age_min ?? null,
        age_max: s.age_max ?? null,
        registration_url: s.registration_url ?? url,
        source_url: url,
      };
    });
    if (!rows.length) return;
    const { error } = await supabase.from("camp_sessions").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${rows.length} session${rows.length > 1 ? "s" : ""}!`);
    onImported();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Import camp sessions</DialogTitle>
          <DialogDescription>
            Paste your camp's website URL and we'll extract sessions automatically.
          </DialogDescription>
        </DialogHeader>
        {!preview ? (
          <form onSubmit={extract} className="space-y-3">
            <div>
              <Label>Website URL</Label>
              <Input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourcamp.com/sessions"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="hero" disabled={loading || !url}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Extracting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Extract sessions
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Found {preview.length} session{preview.length > 1 ? "s" : ""}. Review and pick the
              ones to publish.
            </p>
            <div className="space-y-2">
              {preview.map((s, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected.has(i) ? "border-primary bg-accent/40" : "border-border"}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(i);
                      else next.delete(i);
                      setSelected(next);
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 text-sm">
                    <p className="font-display text-base font-semibold">{s.title}</p>
                    {s.description && (
                      <p className="line-clamp-2 text-muted-foreground">{s.description}</p>
                    )}
                    <p className="mt-1 text-muted-foreground">
                      {[s.start_date, s.end_date].filter(Boolean).join(" – ")}
                      {s.location ? ` · ${s.location}` : ""}
                      {s.price != null ? ` · $${s.price}` : ""}
                      {s.available_spots != null ? ` · ${s.available_spots} spots` : ""}
                      {s.registration_deadline ? ` · register by ${s.registration_deadline}` : ""}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Back
              </Button>
              <Button variant="hero" onClick={save} disabled={selected.size === 0}>
                Publish {selected.size} session{selected.size === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
