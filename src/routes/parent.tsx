import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, School, Baby, Users, Share2, ExternalLink, Trash2, Mail, CalendarDays, Plane, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/SiteHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/parent")({
  validateSearch: z.object({ session: z.string().optional(), invite: z.string().optional() }),
  component: () => (
    <RequireAuth role="parent">
      <ParentDashboard />
    </RequireAuth>
  ),
});

type Kid = {
  id: string; full_name: string; grade: string | null;
  school_id: string | null; class_id: string | null;
  share_with_class: boolean;
};
type School = { id: string; name: string; city: string | null };
type Klass = { id: string; school_id: string; name: string; grade: string | null };
type Reg = { id: string; kid_id: string; session_id: string; status: string };
type Sess = { id: string; title: string; start_date: string; end_date: string; registration_url: string | null; location?: string | null; price_cents?: number | null };
type Vacation = { id: string; start_date: string; end_date: string; kind: string; label: string | null };
type ShareInvite = { id: string; invitee_email: string; accepted_at: string | null; accepted_by: string | null; token: string };

function ParentDashboard() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const [kids, setKids] = useState<Kid[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [sessMap, setSessMap] = useState<Record<string, Sess>>({});
  const [classmateRegs, setClassmateRegs] = useState<(Reg & { kid_name?: string })[]>([]);
  const [kidOpen, setKidOpen] = useState(false);
  const [editingKid, setEditingKid] = useState<Kid | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [pendingSession, setPendingSession] = useState<Sess | null>(null);
  const [shareKidId, setShareKidId] = useState<string | null>(null);
  const [shareKidName, setShareKidName] = useState<string>("");
  const [shareKidClassId, setShareKidClassId] = useState<string | null>(null);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [vacOpen, setVacOpen] = useState(false);

  const loadVacations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("parent_vacations")
      .select("id,start_date,end_date,kind,label")
      .eq("parent_id", user.id)
      .order("start_date");
    setVacations((data ?? []) as Vacation[]);
  };

  const load = async () => {
    if (!user) return;
    try {
      const [{ data: kidsData }, { data: schoolsData }, { data: classesData }] = await Promise.all([
        supabase.from("kids").select("*").eq("parent_id", user.id),
        supabase.from("schools").select("*").order("name"),
        supabase.from("classes").select("*").order("name"),
      ]);
      setKids((kidsData ?? []) as Kid[]);
      setSchools((schoolsData ?? []) as School[]);
      setClasses((classesData ?? []) as Klass[]);

      const { data: regsData } = await supabase.from("registrations").select("*").eq("parent_id", user.id);
      setRegs((regsData ?? []) as Reg[]);

      const sessIds = Array.from(new Set((regsData ?? []).map((r) => r.session_id)));
      let baseSessMap: Record<string, Sess> = {};
      if (sessIds.length) {
        const { data: ss } = await supabase
          .from("camp_sessions")
          .select("id,title,start_date,end_date,registration_url,location,price_cents")
          .in("id", sessIds);
        (ss ?? []).forEach((s) => { baseSessMap[s.id] = s as Sess; });
      }
      setSessMap(baseSessMap);

      // Visible kids = classmates of my kids (where they share with class)
      // PLUS kids directly shared with me via share_invites (by my email).
      const visibleKidIds = new Set<string>();
      const nameById: Record<string, string> = {};

      const myClassIds = (kidsData ?? []).map((k) => k.class_id).filter(Boolean) as string[];
      if (myClassIds.length) {
        const { data: classmateKids } = await supabase
          .from("kids")
          .select("id, full_name, class_id")
          .in("class_id", myClassIds)
          .neq("parent_id", user.id);
        (classmateKids ?? []).forEach((k: any) => {
          if (k.id) { visibleKidIds.add(k.id); nameById[k.id] = k.full_name; }
        });
      }

      if (user.email) {
        await supabase
          .from("share_invites")
          .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
          .ilike("invitee_email", user.email)
          .is("accepted_by", null);

        // Direct child-level share invites addressed to me.
        let inviteQuery = supabase
          .from("share_invites")
          .select("kid_id")
          .ilike("invitee_email", user.email);
        if (search.invite) inviteQuery = inviteQuery.eq("token", search.invite);
        const { data: invites } = await inviteQuery;
        const directIds = (invites ?? []).map((i: any) => i.kid_id).filter(Boolean);
        if (directIds.length) {
          const { data: directKids } = await supabase
            .from("kids")
            .select("id, full_name")
            .in("id", directIds);
          (directKids ?? []).forEach((k: any) => {
            visibleKidIds.add(k.id); nameById[k.id] = k.full_name;
          });
        }
      }

      const ckIds = Array.from(visibleKidIds);
      if (ckIds.length) {
        // Show ALL camps these visible friends are registered/interested in
        // (not just per-registration shared flag). Access is gated by RLS.
        const { data: cRegs } = await supabase
          .from("registrations")
          .select("*")
          .in("kid_id", ckIds);
        setClassmateRegs((cRegs ?? []).map((r: any) => ({ ...r, kid_name: nameById[r.kid_id] })));

        const extraIds = (cRegs ?? []).map((r: any) => r.session_id).filter((id: string) => !baseSessMap[id]);
        if (extraIds.length) {
          const { data: extra } = await supabase
            .from("camp_sessions")
            .select("id,title,start_date,end_date,registration_url,location,price_cents")
            .in("id", extraIds);
          setSessMap((prev) => {
            const m = { ...prev };
            (extra ?? []).forEach((s) => { m[s.id] = s as Sess; });
            return m;
          });
        }
      } else {
        setClassmateRegs([]);
      }
    } catch (err) {
      console.error("parent load failed", err);
    }
  };

  useEffect(() => { load(); loadVacations(); }, [user]);

  // Deep link: /parent?session=...
  useEffect(() => {
    if (!search.session) return;
    (async () => {
      const { data } = await supabase.from("camp_sessions").select("id,title,start_date,end_date,registration_url").eq("id", search.session!).maybeSingle();
      if (data) { setPendingSession(data as Sess); setRegisterOpen(true); }
    })();
  }, [search.session]);

  const deleteKid = async (id: string) => {
    if (!confirm("Remove this kid?")) return;
    await supabase.from("kids").delete().eq("id", id);
    toast.success("Removed");
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-meadow">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">Your family hub</h1>
          <p className="mt-2 text-muted-foreground">Manage your kids and their summer plans.</p>
        </header>

        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold flex items-center gap-2"><Baby className="h-5 w-5" /> My kids</h2>
            <Button variant="hero" onClick={() => { setEditingKid(null); setKidOpen(true); }}>
              <Plus className="h-4 w-4" /> Add kid
            </Button>
          </div>
          {kids.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
              Add your first kid to get started.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {kids.map((k) => {
                const school = schools.find((s) => s.id === k.school_id);
                const klass = classes.find((c) => c.id === k.class_id);
                return (
                  <div key={k.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-semibold">{k.full_name}</h3>
                        {school && <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5"><School className="h-4 w-4" /> {school.name}{klass ? ` · ${klass.name}` : ""}</p>}
                        {k.share_with_class && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"><Users className="h-3 w-3" /> Shares with class</span>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => { setShareKidId(k.id); setShareKidName(k.full_name); setShareKidClassId(k.class_id); }}>
                          <Share2 className="h-4 w-4" /> Manage sharing
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingKid(k); setKidOpen(true); }}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteKid(k.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <SummerCalendar
          regs={regs}
          sessMap={sessMap}
          kids={kids}
          classmateRegs={classmateRegs}
          vacations={vacations}
          onAdd={() => setVacOpen(true)}
          onDeleteVacation={async (id: string) => {
            await supabase.from("parent_vacations").delete().eq("id", id);
            loadVacations();
          }}
          onQuickToggleWeek={async (start: string, end: string) => {
            if (!user) return;
            const existing = vacations.find((v) => v.start_date === start && v.end_date === end);
            if (existing) {
              await supabase.from("parent_vacations").delete().eq("id", existing.id);
            } else {
              await supabase.from("parent_vacations").insert({
                parent_id: user.id, start_date: start, end_date: end, kind: "travel", label: "Family travel",
              });
            }
            loadVacations();
          }}
        />

        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Registered camps</h2>
            <Link to="/sessions"><Button variant="outline">Browse camps</Button></Link>
          </div>
          {regs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
              No registrations yet. <Link to="/sessions" className="font-medium text-primary hover:underline">Find a camp →</Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {regs.map((r) => {
                const s = sessMap[r.session_id];
                const k = kids.find((x) => x.id === r.kid_id);
                if (!s) return null;
                return <RegRow key={r.id} reg={r} session={s} kidName={k?.full_name ?? ""} onChange={load} />;
              })}
            </div>
          )}
        </section>

        {classmateRegs.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 font-display text-2xl font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Classmates' camps</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {classmateRegs.map((r) => {
                const s = sessMap[r.session_id];
                if (!s) return null;
                return (
                  <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{r.kid_name}</p>
                    <p className="font-display text-lg font-semibold">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{new Date(s.start_date).toLocaleDateString()} – {new Date(s.end_date).toLocaleDateString()}</p>
                    {s.registration_url && (
                      <a href={s.registration_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        Visit camp <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <KidDialog
          open={kidOpen} onOpenChange={setKidOpen} editing={editingKid}
          schools={schools} classes={classes}
          onSaved={() => { setKidOpen(false); load(); }}
        />

        <RegisterDialog
          open={registerOpen} onOpenChange={setRegisterOpen}
          session={pendingSession} kids={kids}
          onSaved={() => { setRegisterOpen(false); setPendingSession(null); load(); }}
        />

        <KidShareDialog
          open={!!shareKidId}
          onOpenChange={(v: boolean) => { if (!v) setShareKidId(null); }}
          kidId={shareKidId}
          kidName={shareKidName}
          classId={shareKidClassId}
          klass={classes.find((c) => c.id === shareKidClassId) ?? null}
          onChanged={load}
        />

        <VacationDialog
          open={vacOpen}
          onOpenChange={setVacOpen}
          onSaved={() => { setVacOpen(false); loadVacations(); }}
        />
      </main>
    </div>
  );
}

function RegRow({ reg, session, kidName, onChange }: { reg: Reg; session: Sess; kidName: string; onChange: () => void }) {
  const remove = async () => {
    if (!confirm("Remove registration?")) return;
    await supabase.from("registrations").delete().eq("id", reg.id);
    onChange();
  };

  const setStatus = async (status: "interested" | "registered") => {
    if (status === reg.status) return;
    const { error } = await supabase.from("registrations").update({ status }).eq("id", reg.id);
    if (error) return toast.error(error.message);
    toast.success(status === "registered" ? "Marked as registered 🎉" : "Marked as interested");
    onChange();
  };

  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{kidName}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reg.status === "registered" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
            {reg.status}
          </span>
        </div>
        <h3 className="font-display text-lg font-semibold">{session.title}</h3>
        <p className="text-sm text-muted-foreground">{new Date(session.start_date).toLocaleDateString()} – {new Date(session.end_date).toLocaleDateString()}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setStatus("interested")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${reg.status === "interested" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
          >
            Interested
          </button>
          <button
            type="button"
            onClick={() => setStatus("registered")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${reg.status === "registered" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
          >
            Registered
          </button>
        </div>
        {session.registration_url && reg.status !== "registered" && (
          <a href={session.registration_url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="hero">Complete <ExternalLink className="h-3.5 w-3.5" /></Button>
          </a>
        )}
        <Button size="sm" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </article>
  );
}

function KidDialog({
  open, onOpenChange, editing, schools, classes, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: Kid | null; schools: School[]; classes: Klass[]; onSaved: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("");
  const [shareClass, setShareClass] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.full_name);
      setGrade(editing.grade ?? "");
      setSchoolName(schools.find((s) => s.id === editing.school_id)?.name ?? "");
      setClassName(classes.find((c) => c.id === editing.class_id)?.name ?? "");
      setShareClass(editing.share_with_class);
    } else {
      setName(""); setGrade(""); setSchoolName(""); setClassName(""); setShareClass(false);
    }
  }, [open, editing]);

  const schoolMatches = useMemo(
    () => schools.filter((s) => schoolName && s.name.toLowerCase().includes(schoolName.toLowerCase())).slice(0, 5),
    [schools, schoolName],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      // Resolve / create school
      let schoolId: string | null = null;
      if (schoolName.trim()) {
        const existing = schools.find((s) => s.name.toLowerCase() === schoolName.trim().toLowerCase());
        if (existing) schoolId = existing.id;
        else {
          const { data, error } = await supabase.from("schools").insert({ name: schoolName.trim(), created_by: user.id }).select().single();
          if (error) throw error;
          schoolId = data.id;
        }
      }
      let classId: string | null = null;
      if (schoolId && className.trim()) {
        const existing = classes.find((c) => c.school_id === schoolId && c.name.toLowerCase() === className.trim().toLowerCase());
        if (existing) classId = existing.id;
        else {
          const { data, error } = await supabase.from("classes").insert({ school_id: schoolId, name: className.trim(), created_by: user.id }).select().single();
          if (error) throw error;
          classId = data.id;
        }
      }

      const payload = {
        parent_id: user.id,
        full_name: name,
        grade: grade.trim() || null,
        school_id: schoolId,
        class_id: classId,
        share_with_class: shareClass,
      };
      const { error } = editing
        ? await supabase.from("kids").update(payload).eq("id", editing.id)
        : await supabase.from("kids").insert(payload);
      if (error) throw error;
      toast.success(editing ? "Updated" : "Kid added!");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{editing ? "Edit kid" : "Add a kid"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Grade level</Label>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">Select a grade…</option>
              {["Pre-K", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Label>School</Label>
            <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Type to search or create" />
            {schoolMatches.length > 0 && schoolName !== schoolMatches[0]?.name && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-soft">
                {schoolMatches.map((s) => (
                  <button type="button" key={s.id} onClick={() => setSchoolName(s.name)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted">
                    {s.name}{s.city ? ` · ${s.city}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div><Label>Class</Label><Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Mrs. Chen Grade 3" /></div>
          <label className="flex items-start gap-3 rounded-lg bg-muted p-3">
            <Checkbox checked={shareClass} onCheckedChange={(v) => setShareClass(!!v)} className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Share camp registrations with classmates</span>
              <span className="block text-muted-foreground">Other parents in the same class can see which camps {name || "your kid"} has signed up for.</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RegisterDialog({
  open, onOpenChange, session, kids, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; session: Sess | null; kids: Kid[]; onSaved: () => void }) {
  const { user } = useAuth();
  const [kidId, setKidId] = useState<string>("");
  const [status, setStatus] = useState<"interested" | "registered">("interested");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setKidId(kids[0]?.id ?? ""); setStatus("interested"); }
  }, [open, kids]);

  if (!session) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !kidId) return;
    setSaving(true);
    const { error } = await supabase.from("registrations").upsert({
      kid_id: kidId, session_id: session.id, parent_id: user.id, status,
    }, { onConflict: "kid_id,session_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(status === "registered" ? "Marked as registered 🎉" : "Saved as interested");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add to your camps: {session.title}</DialogTitle>
        </DialogHeader>
        {kids.length === 0 ? (
          <p className="text-muted-foreground">Add a kid first, then come back to register.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Which kid?</Label>
              <select className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={kidId} onChange={(e) => setKidId(e.target.value)}>
                {kids.map((k) => <option key={k.id} value={k.id}>{k.full_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <div className="mt-1 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                <button type="button" onClick={() => setStatus("interested")}
                  className={`rounded-md py-2 text-sm font-medium transition ${status === "interested" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                  Interested
                </button>
                <button type="button" onClick={() => setStatus("registered")}
                  className={`rounded-md py-2 text-sm font-medium transition ${status === "registered" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                  Registered
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {status === "interested"
                  ? "Save it for later — no commitment yet."
                  : "You've completed the signup on the camp's site."}
              </p>
            </div>
            {session.registration_url && status === "interested" && (
              <p className="rounded-lg bg-accent/40 p-3 text-sm text-accent-foreground">
                Don't forget to complete the signup on the camp's website when you're ready.
              </p>
            )}
            <DialogFooter>
              <Button type="submit" variant="hero" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KidShareDialog({
  open, onOpenChange, kidId, kidName, classId, klass, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kidId: string | null;
  kidName: string;
  classId: string | null;
  klass: Klass | null;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [shareWithClass, setShareWithClass] = useState(false);
  const [invites, setInvites] = useState<ShareInvite[]>([]);
  const [classKids, setClassKids] = useState<Kid[]>([]);

  const loadSharing = async () => {
    if (!user || !kidId) return;
    const [{ data: kid }, { data: inviteRows }, classRows] = await Promise.all([
      supabase.from("kids").select("share_with_class").eq("id", kidId).single(),
      supabase
        .from("share_invites")
        .select("id,invitee_email,accepted_at,accepted_by,token")
        .eq("kid_id", kidId)
        .eq("inviter_id", user.id)
        .order("created_at", { ascending: false }),
      classId
        ? supabase.from("kids").select("id,full_name,grade,school_id,class_id,share_with_class,parent_id").eq("class_id", classId).neq("parent_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);
    setShareWithClass(!!kid?.share_with_class);
    setInvites((inviteRows ?? []) as ShareInvite[]);
    setClassKids((classRows.data ?? []) as Kid[]);
  };

  useEffect(() => {
    if (open) loadSharing();
  }, [open, kidId, classId]);

  const toggleClassShare = async (checked: boolean) => {
    if (!kidId) return;
    setShareWithClass(checked);
    const { error } = await supabase.from("kids").update({ share_with_class: checked }).eq("id", kidId);
    if (error) {
      toast.error(error.message);
      setShareWithClass(!checked);
      return;
    }
    toast.success(checked ? "Shared with class" : "Class sharing turned off");
    onChanged();
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from("share_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite removed");
    loadSharing();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !kidId) return;
    setSending(true);
    const inviteeEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from("share_invites")
      .insert({ kid_id: kidId, inviter_id: user.id, invitee_email: inviteeEmail })
      .select()
      .single();
    setSending(false);
    if (error) return toast.error(error.message);
    const link = `${window.location.origin}/parent?invite=${data.token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invite link copied — share it with your friend!");
    setEmail("");
    loadSharing();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Shared with: {kidName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-muted/40 p-3">
            <label className="flex items-start gap-3">
              <Checkbox checked={shareWithClass} onCheckedChange={(v) => toggleClassShare(!!v)} className="mt-0.5" />
              <span className="text-sm">
                <span className="font-medium">Share with {klass?.name ?? "class"}</span>
                <span className="block text-muted-foreground">Parents with kids in this class can see {kidName}'s camp activities.</span>
              </span>
            </label>
            {shareWithClass && (
              <div className="mt-3 rounded-lg bg-card p-3 text-sm">
                <p className="font-medium">Class</p>
                <p className="text-muted-foreground">{klass ? `${klass.name}${klass.grade ? ` · ${klass.grade}` : ""}` : "No class selected"}</p>
                {classKids.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Visible to classmates including {classKids.slice(0, 4).map((k) => k.full_name).join(", ")}{classKids.length > 4 ? ` +${classKids.length - 4} more` : ""}.
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Direct parent shares</h3>
            {invites.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">No direct parent invites yet.</p>
            ) : (
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                    <div>
                      <p className="font-medium">{invite.invitee_email}</p>
                      <p className="text-xs text-muted-foreground">{invite.accepted_at ? "Accepted" : "Pending"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/parent?invite=${invite.token}`).then(() => toast.success("Invite link copied"))}>
                        Copy link
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => revokeInvite(invite.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={submit} className="space-y-3 rounded-xl border border-border p-3">
          <div>
            <Label>Friend's parent email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" />
            <p className="mt-1 text-xs text-muted-foreground">They'll see all of {kidName}'s camp activities through your invite link.</p>
          </div>
          <DialogFooter>
            <Button type="submit" variant="hero" disabled={sending}><Mail className="h-4 w-4" /> Create invite</Button>
          </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Summer Calendar — weeks of summer with vacation/travel marking
// ============================================================================

const SUMMER_WEEKS_2026: Array<{ start: string; end: string; label: string }> = (() => {
  // Mondays from June 1, 2026 (which is a Monday) through Aug 24, 2026 (12 weeks)
  const out: Array<{ start: string; end: string; label: string }> = [];
  const d = new Date(Date.UTC(2026, 5, 1)); // June 1
  for (let i = 0; i < 13; i++) {
    const start = new Date(d);
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() + 6);
    out.push({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      label: `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
})();

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

function SummerCalendar({
  regs, sessMap, kids, classmateRegs, vacations, onAdd, onDeleteVacation, onQuickToggleWeek,
}: {
  regs: Reg[];
  sessMap: Record<string, Sess>;
  kids: Kid[];
  classmateRegs: (Reg & { kid_name?: string })[];
  vacations: Vacation[];
  onAdd: () => void;
  onDeleteVacation: (id: string) => void;
  onQuickToggleWeek: (start: string, end: string) => void;
}) {
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  return (
    <section className="mb-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
          <CalendarDays className="h-5 w-5" /> Summer 2026 calendar
        </h2>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plane className="h-4 w-4" /> Add vacation
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Tap a week to mark it as a travel week (no camp needed). Use “Add vacation” for longer trips. Tap “Friends this week” to see what classmates and shared friends are up to.
      </p>

      <div className="space-y-2">
        {SUMMER_WEEKS_2026.map((w) => {
          const weekRegs = regs.filter((r) => {
            const s = sessMap[r.session_id];
            return s && rangesOverlap(s.start_date, s.end_date, w.start, w.end);
          });
          const weekFriends = classmateRegs.filter((r) => {
            const s = sessMap[r.session_id];
            return s && rangesOverlap(s.start_date, s.end_date, w.start, w.end);
          });
          const vacs = vacations.filter((v) => rangesOverlap(v.start_date, v.end_date, w.start, w.end));
          const isFullWeekTravel = vacs.some((v) => v.start_date === w.start && v.end_date === w.end);
          const onVacation = vacs.length > 0;
          const isOpen = openWeek === w.start;

          return (
            <div
              key={w.start}
              className={`rounded-2xl border p-4 shadow-soft transition ${
                onVacation
                  ? "border-sun bg-sun/15"
                  : weekRegs.length > 0
                  ? "border-primary/40 bg-card"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-base font-semibold">{w.label}</p>
                    {onVacation && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sun px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sun-foreground">
                        <Plane className="h-3 w-3" /> Away
                      </span>
                    )}
                  </div>

                  {weekRegs.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {weekRegs.map((r) => {
                        const s = sessMap[r.session_id];
                        const k = kids.find((x) => x.id === r.kid_id);
                        return (
                          <li key={r.id} className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${r.status === "registered" ? "bg-primary" : "bg-accent-foreground/60"}`} />
                            <span className="font-medium">{k?.full_name ?? "Kid"}</span>
                            <span className="text-muted-foreground">· {s.title}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : !onVacation ? (
                    <p className="mt-1 text-xs text-muted-foreground">No camp planned</p>
                  ) : null}

                  {vacs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {vacs.map((v) => (
                        <span key={v.id} className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground border border-border">
                          {v.label || (v.kind === "vacation" ? "Vacation" : "Travel")}
                          <button onClick={() => onDeleteVacation(v.id)} className="ml-0.5 text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setOpenWeek(isOpen ? null : w.start)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Friends this week ({weekFriends.length})
                      <span className={`transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
                    </button>
                    {isOpen && (
                      <div className="mt-2 rounded-xl border border-border bg-background/60 p-3">
                        {weekFriends.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No friends have shared activities this week yet.</p>
                        ) : (
                          <ul className="space-y-1.5 text-sm">
                            {weekFriends.map((r) => {
                              const s = sessMap[r.session_id];
                              const withMe = regs.some((mine) => mine.session_id === r.session_id);
                              const price = s?.price_cents != null ? `$${(s.price_cents / 100).toFixed(0)}` : null;
                              return (
                                <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className={`h-1.5 w-1.5 rounded-full ${r.status === "registered" ? "bg-primary" : "bg-accent-foreground/60"}`} />
                                  <span className="font-medium">{r.kid_name ?? "Friend"}</span>
                                  <span className="text-muted-foreground">· {s?.title ?? "Camp"}</span>
                                  {price && <span className="text-xs text-muted-foreground">· {price}</span>}
                                  {withMe && (
                                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">With me</span>
                                  )}
                                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">{r.status}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={isFullWeekTravel ? "sun" : "ghost"}
                  onClick={() => onQuickToggleWeek(w.start, w.end)}
                >
                  {isFullWeekTravel ? "Clear travel" : "Mark as travel"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VacationDialog({
  open, onOpenChange, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState<"vacation" | "travel">("vacation");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setStart(""); setEnd(""); setKind("vacation"); setLabel(""); }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (start > end) { toast.error("End date must be after start date"); return; }
    setSaving(true);
    const { error } = await supabase.from("parent_vacations").insert({
      parent_id: user.id, start_date: start, end_date: end, kind, label: label || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Added to your calendar");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add a vacation or travel week</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <button type="button" onClick={() => setKind("vacation")}
              className={`rounded-md py-2 text-sm font-medium transition ${kind === "vacation" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
              Family vacation
            </button>
            <button type="button" onClick={() => setKind("travel")}
              className={`rounded-md py-2 text-sm font-medium transition ${kind === "travel" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
              Travel week
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>End</Label><Input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div><Label>Label (optional)</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Beach trip" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
