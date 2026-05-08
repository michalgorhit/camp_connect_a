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
  validateSearch: z.object({ session: z.string().optional() }),
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
type Reg = { id: string; kid_id: string; session_id: string; status: string; shared_with_class: boolean };
type Sess = { id: string; title: string; start_date: string; end_date: string; registration_url: string | null; location?: string | null };
type Vacation = { id: string; start_date: string; end_date: string; kind: string; label: string | null };

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
          .select("id,title,start_date,end_date,registration_url,location")
          .in("id", sessIds);
        (ss ?? []).forEach((s) => { baseSessMap[s.id] = s as Sess; });
      }
      setSessMap(baseSessMap);

      // Classmate registrations — fetch in two steps to avoid embed dependency
      const myClassIds = (kidsData ?? []).map((k) => k.class_id).filter(Boolean) as string[];
      if (myClassIds.length) {
        const { data: classmateKids } = await supabase
          .from("kids")
          .select("id, full_name, class_id")
          .in("class_id", myClassIds)
          .neq("parent_id", user.id);
        const ckIds = (classmateKids ?? []).map((k: any) => k.id);
        if (ckIds.length) {
          const { data: cRegs } = await supabase
            .from("registrations")
            .select("*")
            .in("kid_id", ckIds)
            .eq("shared_with_class", true);
          const nameById: Record<string, string> = {};
          (classmateKids ?? []).forEach((k: any) => { nameById[k.id] = k.full_name; });
          setClassmateRegs((cRegs ?? []).map((r: any) => ({ ...r, kid_name: nameById[r.kid_id] })));

          const extraIds = (cRegs ?? []).map((r: any) => r.session_id).filter((id: string) => !baseSessMap[id]);
          if (extraIds.length) {
            const { data: extra } = await supabase
              .from("camp_sessions")
              .select("id,title,start_date,end_date,registration_url,location")
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
                        <Button size="sm" variant="ghost" onClick={() => { setShareKidId(k.id); setShareKidName(k.full_name); }}><Share2 className="h-4 w-4" /></Button>
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
          vacations={vacations}
          onAdd={() => setVacOpen(true)}
          onDeleteVacation={async (id) => {
            await supabase.from("parent_vacations").delete().eq("id", id);
            loadVacations();
          }}
          onQuickToggleWeek={async (start, end) => {
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
  const [shareOpen, setShareOpen] = useState(false);
  const toggleShared = async () => {
    const { error } = await supabase.from("registrations").update({ shared_with_class: !reg.shared_with_class }).eq("id", reg.id);
    if (error) return toast.error(error.message);
    onChange();
  };
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
        <Button size="sm" variant={reg.shared_with_class ? "sun" : "outline"} onClick={toggleShared}>
          <Users className="h-4 w-4" /> {reg.shared_with_class ? "Sharing with class" : "Share with class"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}><Share2 className="h-4 w-4" /> Invite friend</Button>
        {session.registration_url && reg.status !== "registered" && (
          <a href={session.registration_url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="hero">Complete <ExternalLink className="h-3.5 w-3.5" /></Button>
          </a>
        )}
        <Button size="sm" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <InviteDialog open={shareOpen} onOpenChange={setShareOpen} regId={reg.id} sessionTitle={session.title} />
    </article>
  );
}

function InviteDialog({ open, onOpenChange, regId, sessionTitle }: { open: boolean; onOpenChange: (v: boolean) => void; regId: string; sessionTitle: string }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSending(true);
    const { data, error } = await supabase.from("share_invites").insert({ registration_id: regId, inviter_id: user.id, invitee_email: email }).select().single();
    setSending(false);
    if (error) return toast.error(error.message);
    const link = `${window.location.origin}/sessions?invite=${data.token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invite created — link copied to clipboard");
    setEmail("");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Invite a friend to {sessionTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Friend's parent email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" />
            <p className="mt-1 text-xs text-muted-foreground">We'll create a link you can share with them.</p>
          </div>
          <DialogFooter>
            <Button type="submit" variant="hero" disabled={sending}><Mail className="h-4 w-4" /> Create invite</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const [share, setShare] = useState(true);
  const [status, setStatus] = useState<"interested" | "registered">("interested");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setKidId(kids[0]?.id ?? ""); setShare(true); setStatus("interested"); }
  }, [open, kids]);

  if (!session) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !kidId) return;
    setSaving(true);
    const { error } = await supabase.from("registrations").upsert({
      kid_id: kidId, session_id: session.id, parent_id: user.id, status, shared_with_class: share,
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
            <label className="flex items-start gap-3 rounded-lg bg-muted p-3">
              <Checkbox checked={share} onCheckedChange={(v) => setShare(!!v)} className="mt-0.5" />
              <span className="text-sm">
                <span className="font-medium">Share with classmates</span>
                <span className="block text-muted-foreground">Other parents in their class will see this.</span>
              </span>
            </label>
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
  open, onOpenChange, kidId, kidName,
}: { open: boolean; onOpenChange: (v: boolean) => void; kidId: string | null; kidName: string }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !kidId) return;
    setSending(true);
    const { data, error } = await supabase
      .from("share_invites")
      .insert({ kid_id: kidId, inviter_id: user.id, invitee_email: email })
      .select()
      .single();
    setSending(false);
    if (error) return toast.error(error.message);
    const link = `${window.location.origin}/sessions?invite=${data.token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invite link copied — share it with your friend!");
    setEmail("");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Share {kidName}'s camps with a friend</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Friend's parent email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" />
            <p className="mt-1 text-xs text-muted-foreground">They'll see all of {kidName}'s camp activities through your invite link.</p>
          </div>
          <DialogFooter>
            <Button type="submit" variant="hero" disabled={sending}><Mail className="h-4 w-4" /> Create invite</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
