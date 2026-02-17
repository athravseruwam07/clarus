import { ArrowDown, CalendarClock, CheckCircle2, ShieldCheck } from "lucide-react";
import Image from "next/image";

import { ConnectForm } from "@/components/auth/ConnectForm";

const CORE_FEATURES = [
  {
    title: "Unified workload timeline",
    description: "Assignments, quizzes, exams, and events synced into one live academic view.",
    icon: CalendarClock
  },
  {
    title: "Actionable daily plan",
    description: "Priority-ranked next steps with plain-language guidance you can execute now.",
    icon: CheckCircle2
  },
  {
    title: "Secure Brightspace connection",
    description: "Sign in through your school login flow while Clarus handles setup in the background.",
    icon: ShieldCheck
  }
] as const;

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_78%,rgba(8,46,116,0.35),transparent_45%)]" />

      <div className="landing-snap relative h-screen overflow-y-auto scroll-smooth">
        <section className="landing-panel flex min-h-screen items-center px-5 py-16 md:px-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.45)] md:h-28 md:w-28">
              <Image
                alt="Clarus logo"
                className="h-full w-full scale-[1.1] object-cover translate-y-1"
                height={112}
                priority
                src="/Clarus-logo.svg"
                width={112}
              />
            </div>
            <p className="mt-6 text-xs uppercase tracking-[0.22em] text-primary/90">Clarus</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl">
              Turn Brightspace into a clear daily action plan.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              One connected workspace for deadlines, priorities, and study execution.
            </p>
            <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
              <ArrowDown className="h-4 w-4" />
              Scroll to explore
            </div>
          </div>
        </section>

        <section className="landing-panel flex min-h-screen items-center px-5 py-16 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">What Clarus does</h2>
              <p className="mt-3 text-muted-foreground">
                Three core capabilities designed for student execution, not dashboard noise.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {CORE_FEATURES.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="rounded-2xl border border-border/70 bg-card/70 p-6 shadow-[0_16px_45px_rgba(0,0,0,0.35)] backdrop-blur-sm"
                  >
                    <div className="mb-4 inline-flex rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold leading-snug">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="landing-panel flex min-h-screen items-center px-5 py-16 md:px-8">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-primary/90">Try Clarus</p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Connect Brightspace and start your workspace.
              </h2>
              <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                Sign in once and Clarus will sync your courses, deadlines, and planning context.
              </p>
            </div>

            <div className="w-full">
              <ConnectForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
