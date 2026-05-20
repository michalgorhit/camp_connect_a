import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
} from "@/components/ui/dialog";

export type SessionBase = {
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
  source_url?: string | null;
  is_published: boolean;
  day_type?: string | null;
};

export function SessionDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SessionBase | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    postal_code: "",
    start_date: "",
    end_date: "",
    registration_deadline: "",
    price: "",
    age_min: "",
    age_max: "",
    capacity: "",
    available_spots: "",
    registration_url: "",
    day_type: "full_day" as "half_day" | "full_day" | "multi_week",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description ?? "",
        location: editing.location ?? "",
        postal_code: editing.postal_code ?? "",
        start_date: editing.start_date,
        end_date: editing.end_date,
        registration_deadline: editing.registration_deadline ?? "",
        price: editing.price_cents != null ? (editing.price_cents / 100).toString() : "",
        age_min: editing.age_min?.toString() ?? "",
        age_max: editing.age_max?.toString() ?? "",
        capacity: editing.capacity?.toString() ?? "",
        available_spots: editing.available_spots?.toString() ?? "",
        registration_url: editing.registration_url ?? "",
        day_type: (editing.day_type ?? "full_day") as any,
      });
    } else {
      setForm({
        title: "",
        description: "",
        location: "",
        postal_code: "",
        start_date: "",
        end_date: "",
        registration_deadline: "",
        price: "",
        age_min: "",
        age_max: "",
        capacity: "",
        available_spots: "",
        registration_url: "",
        day_type: "full_day",
      });
    }
  }, [editing, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload: any = {
      vendor_id: user.id, // Admin will overwrite this later if needed, but we save it as them initially
      created_by: user.id,
      source: "vendor", // We can override this in the admin flow if needed, but for now vendor is okay
      capacity_known: true,
      day_type: form.day_type,
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      postal_code: form.postal_code || null,
      start_date: form.start_date,
      end_date: form.end_date,
      registration_deadline: form.registration_deadline || null,
      price_cents: form.price ? Math.round(Number(form.price) * 100) : null,
      age_min: form.age_min ? Number(form.age_min) : null,
      age_max: form.age_max ? Number(form.age_max) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      available_spots: form.available_spots ? Number(form.available_spots) : null,
      registration_url: form.registration_url || null,
    };

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (roleData?.role === "admin") {
      payload.source = "admin";
    }

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
          <DialogTitle className="font-display text-2xl">
            {editing ? "Edit session" : "New session"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Description / comments</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <Label>Area / postal code</Label>
              <Input
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                placeholder="e.g. 94110"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Starts</Label>
              <Input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Ends</Label>
              <Input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Registration deadline</Label>
            <Input
              type="date"
              value={form.registration_deadline}
              onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Price ($)</Label>
              <Input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <Label>Age min</Label>
              <Input
                type="number"
                value={form.age_min}
                onChange={(e) => setForm({ ...form, age_min: e.target.value })}
              />
            </div>
            <div>
              <Label>Age max</Label>
              <Input
                type="number"
                value={form.age_max}
                onChange={(e) => setForm({ ...form, age_max: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Capacity</Label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
            <div>
              <Label>Available spots</Label>
              <Input
                type="number"
                value={form.available_spots}
                onChange={(e) => setForm({ ...form, available_spots: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Length</Label>
            <div className="mt-1 flex gap-2">
              {(["half_day", "full_day", "multi_week"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, day_type: k })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${form.day_type === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
                >
                  {k === "half_day" ? "Half-day" : k === "full_day" ? "Full day" : "Multi-week"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Registration URL (your site)</Label>
            <Input
              type="url"
              placeholder="https://yourcamp.com/register"
              value={form.registration_url}
              onChange={(e) => setForm({ ...form, registration_url: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Parents click through to register on your site.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save" : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
