"use client";

import { Check, ChevronDown, Globe, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError, loginClarus, registerClarus } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectForm } from "./ConnectForm";

type UniversityEntry = {
  id: string;
  name: string;
  instanceUrl: string;
  logoSrc?: string;
};

const UNIVERSITIES: UniversityEntry[] = [
  { id: "waterloo", name: "University of Waterloo", instanceUrl: "https://learn.uwaterloo.ca", logoSrc: "/universities/waterloo.svg" },
  { id: "york", name: "York University", instanceUrl: "https://york.brightspace.com", logoSrc: "/universities/york.svg" },
  { id: "mcmaster", name: "McMaster University", instanceUrl: "https://avenue.mcmaster.ca", logoSrc: "/universities/mcmaster.svg" },
  { id: "queens", name: "Queen's University", instanceUrl: "https://onq.queensu.ca", logoSrc: "/universities/queens.png" },
  { id: "guelph", name: "University of Guelph", instanceUrl: "https://courselink.uoguelph.ca", logoSrc: "/universities/guelph.jpg" },
  { id: "tmu", name: "Toronto Metropolitan University", instanceUrl: "https://d2l.torontomu.ca", logoSrc: "/universities/tmu.svg" }
];

// Mirrors the UniversityLogo component in ConnectForm
function UniversityLogo(props: { name: string; logoSrc?: string; instanceUrl?: string }) {
  const { name, logoSrc, instanceUrl } = props;
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(" ")
    .filter((p) => p.length > 0)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  if (logoSrc && !failed) {
    return (
      <img
        alt={`${name} logo`}
        className="h-7 w-7 rounded-md bg-secondary/20 object-contain"
        src={logoSrc}
        onError={() => setFailed(true)}
      />
    );
  }

  if (instanceUrl && !failed) {
    return (
      <img
        alt={`${name} logo`}
        className="h-7 w-7 rounded-md bg-secondary/20 object-contain"
        src={`${new URL(instanceUrl).origin}/favicon.ico`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-secondary-foreground">
      {initials}
    </div>
  );
}

type Tab = "signin" | "signup";
type PanelState = "auth" | "connect-d2l" | "guest";

// Maps a university name back to its UNIVERSITIES entry ID (for pre-filling ConnectForm)
function universityNameToId(name: string): string {
  return UNIVERSITIES.find((u) => u.name === name)?.id ?? "other";
}

function UniversityDropdown(props: {
  value: string; // university name or "other"
  customValue: string;
  onChange: (name: string) => void;
  onCustomChange: (val: string) => void;
  disabled?: boolean;
}) {
  const { value, customValue, onChange, onCustomChange, disabled } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = value === "other" ? null : (UNIVERSITIES.find((u) => u.name === value) ?? null);
  const isOther = value === "other";

  return (
    <div ref={ref} className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex items-center gap-2">
          {isOther ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <Globe className="h-4 w-4" />
            </div>
          ) : selected ? (
            <UniversityLogo name={selected.name} logoSrc={selected.logoSrc} instanceUrl={selected.instanceUrl} />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <Globe className="h-4 w-4" />
            </div>
          )}
          <span className={selected || isOther ? "text-foreground" : "text-muted-foreground"}>
            {isOther ? "Other" : (selected?.name ?? "Select your university")}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
          <div className="max-h-56 overflow-auto">
            {UNIVERSITIES.map((u) => {
              const isSel = u.name === value;
              return (
                <button
                  key={u.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary",
                    isSel ? "bg-secondary/40" : ""
                  )}
                  onClick={() => {
                    onChange(u.name);
                    setOpen(false);
                  }}
                >
                  <UniversityLogo name={u.name} logoSrc={u.logoSrc} instanceUrl={u.instanceUrl} />
                  <span className="flex-1">{u.name}</span>
                  {isSel ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              );
            })}

            <div className="border-t border-border">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary",
                  isOther ? "bg-secondary/40" : ""
                )}
                onClick={() => {
                  onChange("other");
                  setOpen(false);
                }}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Globe className="h-4 w-4" />
                </div>
                <span className="flex-1">Other</span>
                {isOther ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isOther ? (
        <Input
          placeholder="Type your university name"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          disabled={disabled}
          autoFocus
        />
      ) : null}
    </div>
  );
}

function SignInForm(props: { onSuccess: (universityId: string) => void }) {
  const { onSuccess } = props;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const result = await loginClarus({ email, password });
      toast.success("Signed in to Clarus");
      const universityId = result.user.university ? universityNameToId(result.user.university) : "";
      onSuccess(universityId);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Sign in failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          placeholder="email@university.domain"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="current-password"
          required
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Sign in failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button className="w-full" type="submit" disabled={loading || !email || !password}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm(props: { onSuccess: (universityId: string) => void }) {
  const { onSuccess } = props;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [universityValue, setUniversityValue] = useState(""); // name or "other"
  const [customUniversity, setCustomUniversity] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resolvedUniversity = universityValue === "other" ? customUniversity.trim() : universityValue;

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      resolvedUniversity.length > 0 &&
      password.length >= 8 &&
      password === confirm
    );
  }, [name, email, resolvedUniversity, password, confirm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setError(null);
    setLoading(true);

    try {
      await registerClarus({ name: name.trim(), email: email.trim(), password, university: resolvedUniversity });
      toast.success("Account created!");
      const universityId = universityValue === "other" ? "other" : universityNameToId(universityValue);
      onSuccess(universityId);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Sign up failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          type="text"
          placeholder="Alex Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoComplete="name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="email@university.domain"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
          required
        />
      </div>

      <div className="relative space-y-2">
        <Label>University</Label>
        <UniversityDropdown
          value={universityValue}
          customValue={customUniversity}
          onChange={setUniversityValue}
          onCustomChange={setCustomUniversity}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-confirm">Confirm password</Label>
        <Input
          id="signup-confirm"
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
          required
        />
        {confirm.length > 0 && password !== confirm ? (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Sign up failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button className="w-full" type="submit" disabled={!canSubmit || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {loading ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}

// Step indicator shown above ConnectForm after Clarus auth
function StepIndicator() {
  return (
    <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1 text-primary">
        <Check className="h-3.5 w-3.5" />
        Account created
      </span>
      <span className="h-px flex-1 bg-border" />
      <span className="font-medium text-foreground">Connect Brightspace</span>
      <span className="h-px flex-1 bg-border" />
      <span>Dashboard</span>
    </div>
  );
}

export function AuthPanel() {
  const [panelState, setPanelState] = useState<PanelState>("auth");
  const [activeTab, setActiveTab] = useState<Tab>("signin");
  const [postAuthUniversityId, setPostAuthUniversityId] = useState<string>("");

  function handleAuthSuccess(universityId: string) {
    setPostAuthUniversityId(universityId);
    setPanelState("connect-d2l");
  }

  if (panelState === "connect-d2l") {
    return (
      <div className="w-full">
        <StepIndicator />
        <ConnectForm defaultUniversityId={postAuthUniversityId} />
      </div>
    );
  }

  if (panelState === "guest") {
    return (
      <div className="w-full">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelState("auth")}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            ← Back to sign in
          </button>
        </div>
        <ConnectForm />
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <CardDescription>Sign in or create your Clarus account to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/15 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("signin")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "signin"
                ? "bg-secondary/80 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground"
            )}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("signup")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "signup"
                ? "bg-secondary/80 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground"
            )}
          >
            Sign up
          </button>
        </div>

        {activeTab === "signin" ? (
          <SignInForm onSuccess={handleAuthSuccess} />
        ) : (
          <SignUpForm onSuccess={handleAuthSuccess} />
        )}

        <div className="relative flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={() => setPanelState("guest")}
          className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Continue as guest
        </button>
      </CardContent>
    </Card>
  );
}
