import { CalendarClock, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

import { ConnectForm } from "@/components/auth/ConnectForm";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.16),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_50%)]" />

      <section className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-6">
        <div className="space-y-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            clarus platform
          </p>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Clarus turns Brightspace into a clear, daily action plan.
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              Sync your Brightspace account once, then get deadlines, priorities, and AI guidance in
              one workspace built for students.
            </p>
          </div>

          <div className="grid gap-3 md:max-w-2xl md:grid-cols-3">
            <article className="rounded-xl border border-border/70 bg-card/40 p-4">
              <CalendarClock className="mb-2 h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Everything in one timeline</p>
              <p className="mt-1 text-xs text-muted-foreground">
                assignments, quizzes, exams, and key course events.
              </p>
            </article>
            <article className="rounded-xl border border-border/70 bg-card/40 p-4">
              <CheckCircle2 className="mb-2 h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Actionable next steps</p>
              <p className="mt-1 text-xs text-muted-foreground">
                AI-generated briefs, checklists, and study planning.
              </p>
            </article>
            <article className="rounded-xl border border-border/70 bg-card/40 p-4">
              <ShieldCheck className="mb-2 h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Secure by design</p>
              <p className="mt-1 text-xs text-muted-foreground">
                sign in happens in the Brightspace popup window.
              </p>
            </article>
          </div>
        </div>

        <div className="w-full">
          <ConnectForm />
        </div>
      </section>
    </main>
  );
}
