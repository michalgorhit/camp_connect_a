import { createFileRoute, Link } from "@tanstack/react-router";
import { Sun, Users, Share2, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import heroImg from "@/assets/hero-camp.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-gradient-meadow">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-20 md:pt-20 md:pb-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Summer 2026 enrollment is open
              </span>
              <h1 className="mt-5 font-display text-5xl font-bold leading-[0.95] tracking-tight md:text-6xl">
                The summer your kids will <em className="italic text-primary">never forget</em>.
              </h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                Discover great camps, register in seconds, and bring along their classmates and friends —
                because summer is better with the whole crew.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/auth" search={{ mode: "signup", role: "parent" } as never}>
                  <Button variant="hero" size="xl">
                    I'm a parent <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/auth" search={{ mode: "signup", role: "vendor" } as never}>
                  <Button variant="sun" size="xl">List my camp</Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Free for parents. No card needed to browse.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-sun blur-2xl opacity-60" />
              <div className="absolute -right-8 bottom-4 h-32 w-32 rounded-full bg-coral blur-3xl opacity-40" />
              <img
                src={heroImg}
                alt="Children at a summer camp painting and kayaking together"
                className="relative aspect-[4/3] w-full rounded-3xl object-cover shadow-pop"
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Sun className="h-5 w-5" />}
              title="Hand-picked camps"
              body="Browse vetted vendors, from coding bootcamps to forest kayaking adventures."
            />
            <FeatureCard
              icon={<Users className="h-5 w-5" />}
              title="School & class aware"
              body="Connect kids to their school. See which camps their classmates are going to."
            />
            <FeatureCard
              icon={<Share2 className="h-5 w-5" />}
              title="Invite friends"
              body="Tick a box to share with the class, or send invites to friends from other schools."
            />
          </div>
        </section>

        {/* CTA Strip */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="rounded-3xl bg-primary p-10 text-primary-foreground shadow-pop md:p-14">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h2 className="font-display text-3xl font-semibold md:text-4xl">Run a camp? Reach the right families.</h2>
                <p className="mt-2 max-w-md text-primary-foreground/80">
                  Publish your sessions in minutes. We send qualified parents your way — they register on your site.
                </p>
              </div>
              <Link to="/auth" search={{ mode: "signup", role: "vendor" } as never}>
                <Button variant="sun" size="xl">Become a vendor</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Summer Buddy Connect. Made with sunshine.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">{icon}</div>
      <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
