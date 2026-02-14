import { ConnectForm } from "@/components/auth/ConnectForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10">
      <section className="grid w-full gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <p className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs uppercase tracking-wider text-secondary-foreground">
            clarus hackathon mvp
          </p>
          <h1 className="text-4xl font-bold leading-tight">
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
