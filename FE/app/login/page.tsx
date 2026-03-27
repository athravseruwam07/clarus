import { ArrowDown } from "lucide-react";
import Image from "next/image";

import { AuthPanel } from "@/components/auth/AuthPanel";
import FeatureShowcaseCards from "@/components/marketing/FeatureShowcaseCards";
import PixelGalaxyBackground from "@/components/marketing/PixelGalaxyBackground";

export default function LoginPage() {
  return (
    <main className="landing-fixed-theme landing-space-surface relative min-h-screen overflow-hidden text-foreground">
      <PixelGalaxyBackground />
      <div className="landing-snap relative h-screen overflow-y-auto scroll-smooth">
        <section className="landing-panel relative flex min-h-screen items-center overflow-hidden px-5 py-16 md:px-8">
          <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_26px_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.45)]">
              <Image
                alt="Clarus logo"
                className="h-full w-full scale-[1.1] object-cover translate-y-1"
                height={80}
                priority
                src="/Clarus-logo.svg"
                width={80}
              />
            </div>
            <p className="mt-6 inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-foreground/70 backdrop-blur-sm">
              Clarus
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-foreground md:text-6xl">
              Turn Brightspace into a brighter space.
            </h1>
            <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
              <ArrowDown className="h-4 w-4 animate-bounce" />
              Scroll to explore
            </div>
          </div>
        </section>

        <section className="landing-panel flex min-h-screen items-center px-5 py-16 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] md:text-4xl">What Clarus does</h2>
            </div>

            <FeatureShowcaseCards />
          </div>
        </section>

        <section className="landing-panel flex min-h-screen items-center px-5 py-16 md:px-8">
          <div className="mx-auto grid min-h-[calc(100svh-8rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
            <div className="space-y-4">
              <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-[-0.03em] md:text-5xl">
                Sign in or create your Clarus account.
              </h2>
            </div>

            <div className="w-full">
              <AuthPanel />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
