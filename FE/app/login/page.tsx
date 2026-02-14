import { ConnectForm } from "@/components/auth/ConnectForm";

export default function LoginPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10">
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />
      </div>
      <section className="relative grid w-full gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <p className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-wider text-primary">
            clarus hackathon mvp
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            ai-powered control system for <span className="text-primary">d2l brightspace</span>
          </h1>
          <p className="max-w-prose text-muted-foreground">
            clarus eliminates friction and tells students exactly what to do and where to find the
            right course content.
          </p>
        </div>
        <ConnectForm />
      </section>
    </main>
  );
}
