"use client";

import { Check, CheckCircle2, ChevronDown, Circle, Globe, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError, connectD2L } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UniversityOption = {
  id: string;
  name: string;
  instanceUrl: string;
  logoSrc?: string;
  requiresManualUrl?: boolean;
};

const CANADIAN_UNIVERSITIES: UniversityOption[] = [
  {
    id: "waterloo",
    name: "University of Waterloo",
    instanceUrl: "https://learn.uwaterloo.ca",
    logoSrc: "/universities/waterloo.svg"
  },
  {
    id: "york",
    name: "York University",
    instanceUrl: "https://york.brightspace.com",
    logoSrc: "/universities/york.svg"
  },
  {
    id: "mcmaster",
    name: "McMaster University",
    instanceUrl: "https://avenue.mcmaster.ca",
    logoSrc: "/universities/mcmaster.svg"
  },
  {
    id: "queens",
    name: "Queen's University",
    instanceUrl: "https://onq.queensu.ca",
    logoSrc: "/universities/queens.png"
  },
  {
    id: "guelph",
    name: "University of Guelph",
    instanceUrl: "https://courselink.uoguelph.ca",
    logoSrc: "/universities/guelph.jpg"
  },
  {
    id: "tmu",
    name: "Toronto Metropolitan University",
    instanceUrl: "https://d2l.torontomu.ca",
    logoSrc: "/universities/tmu.svg"
  }
];

const CONNECT_PROGRESS_STEPS = [
  {
    title: "opening Brightspace sign-in",
    description: "launching your institution login window."
  },
  {
    title: "waiting for secure authentication",
    description: "complete SSO/MFA in the Brightspace popup."
  },
  {
    title: "verifying account connection",
    description: "confirming your Brightspace connection."
  },
  {
    title: "starting Clarus workspace",
    description: "loading your dashboard and connected features."
  }
] as const;

function faviconUrl(instanceUrl: string): string {
  // Prefer the instance's own favicon (avoids the Google S2 fallback globe icons).
  // This is only used as a fallback when we don't have a bundled logo.
  return `${new URL(instanceUrl).origin}/favicon.ico`;
}

function initials(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const letters = parts.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase();
}

function UniversityLogo(props: {
  name: string;
  logoSrc?: string;
  instanceUrl?: string;
  className?: string;
}) {
  const { name, logoSrc, instanceUrl, className } = props;
  const [failed, setFailed] = useState(false);

  if (logoSrc && !failed) {
    return (
      <img
        alt={`${name} logo`}
        className={cn("h-7 w-7 rounded-md bg-secondary/20 object-contain", className)}
        src={logoSrc}
        onError={() => setFailed(true)}
      />
    );
  }

  if (!instanceUrl || failed) {
    return (
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-secondary-foreground",
          className
        )}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <img
      alt={`${name} logo`}
      className={cn("h-7 w-7 rounded-md bg-secondary/20 object-contain", className)}
      src={faviconUrl(instanceUrl)}
      onError={() => setFailed(true)}
    />
  );
}

export function ConnectForm() {
  const router = useRouter();
  const [selectedUniversityId, setSelectedUniversityId] = useState<string>("");
  const [customInstanceUrl, setCustomInstanceUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [progressStepIndex, setProgressStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const didLeavePageRef = useRef(false);

  const selectedUniversity = useMemo(() => {
    if (selectedUniversityId === "other") {
      return null;
    }

    return CANADIAN_UNIVERSITIES.find((option) => option.id === selectedUniversityId) ?? null;
  }, [selectedUniversityId]);

  const resolvedInstanceUrl = useMemo(() => {
    if (selectedUniversityId === "other") {
      return customInstanceUrl;
    }

    if (selectedUniversity?.requiresManualUrl) {
      return customInstanceUrl;
    }

    return selectedUniversity?.instanceUrl ?? "";
  }, [customInstanceUrl, selectedUniversity, selectedUniversityId]);

  const canSubmit = useMemo(() => {
    return resolvedInstanceUrl.trim().length > 0;
  }, [resolvedInstanceUrl]);

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    didLeavePageRef.current = false;

    const onBlur = () => {
      didLeavePageRef.current = true;
    };

    const onVisibleAgain = () => {
      if (didLeavePageRef.current) {
        // User likely returned from popup login, now backend validates session.
        setProgressStepIndex((current) => (current < 2 ? 2 : current));
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onVisibleAgain();
      }
    };

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onVisibleAgain);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onVisibleAgain);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isSubmitting]);

  useEffect(() => {
    if (!isSubmitting) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isSubmitting]);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setProgressStepIndex((current) => (current < 1 ? 1 : current));
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [isSubmitting]);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    if (elapsedSeconds >= 10 && didLeavePageRef.current) {
      setProgressStepIndex((current) => (current < 2 ? 2 : current));
    }
  }, [elapsedSeconds, isSubmitting]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setProgressStepIndex(0);
    setErrorMessage(null);
    let didSucceed = false;

    try {
      await connectD2L({
        instanceUrl: resolvedInstanceUrl,
        mode: "manual"
      });

      // Backend confirmed session is stored and valid.
      setProgressStepIndex((current) => (current < 2 ? 2 : current));
      await new Promise((resolve) => window.setTimeout(resolve, 320));
      setProgressStepIndex(3);
      await new Promise((resolve) => window.setTimeout(resolve, 420));

      toast.success("Connected to D2L", {
        description: "Your command center is ready."
      });
      didSucceed = true;
      router.push("/dashboard?boot=1");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "could not log into D2L. your school may use custom sso/duo. try headful debug or selector overrides.";

      setErrorMessage(message);
      toast.error("connection failed", {
        description: message
      });
    } finally {
      if (!didSucceed) {
        setProgressStepIndex(0);
        setIsSubmitting(false);
      }
    }
  }

  return (
    <Card className="border-primary/20 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <CardHeader>
        <CardTitle>Connect Brightspace</CardTitle>
        <CardDescription>
          A Brightspace login window opens for sign-in. Once completed, Clarus finishes setup
          automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2" ref={dropdownRef}>
            <Label>school</Label>
            <button
              type="button"
              disabled={isSubmitting}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setIsDropdownOpen((open) => !open)}
            >
              <span className="flex items-center gap-2">
                {selectedUniversityId ? (
                  <UniversityLogo
                    name={selectedUniversity?.name ?? "Other"}
                    logoSrc={selectedUniversity?.logoSrc}
                    instanceUrl={selectedUniversity?.instanceUrl}
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Globe className="h-4 w-4" />
                  </div>
                )}
                <span className="flex flex-col leading-tight">
                  <span className="font-medium">
                    {selectedUniversityId
                      ? selectedUniversity?.name ?? "Other (enter instance url)"
                      : "Select your school"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {!selectedUniversityId
                      ? "choose from the list"
                      : selectedUniversity?.requiresManualUrl
                        ? "paste your school brightspace url"
                        : selectedUniversity?.instanceUrl
                          ? new URL(selectedUniversity.instanceUrl).hostname
                          : "paste your school brightspace url"}
                  </span>
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {isDropdownOpen ? (
              <div className="relative">
                <div className="absolute left-0 z-50 mt-2 w-full overflow-hidden rounded-md border border-border bg-card shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                  <div className="max-h-72 overflow-auto">
                    {CANADIAN_UNIVERSITIES.map((option) => {
                      const isSelected = option.id === selectedUniversityId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary",
                            isSelected ? "bg-secondary/40" : ""
                          )}
                          onClick={() => {
                            setSelectedUniversityId(option.id);
                            if (option.requiresManualUrl) {
                              setCustomInstanceUrl("");
                            }
                            setIsDropdownOpen(false);
                          }}
                        >
                          <UniversityLogo
                            name={option.name}
                            logoSrc={option.logoSrc}
                            instanceUrl={option.instanceUrl || undefined}
                          />
                          <span className="flex flex-1 flex-col leading-tight">
                            <span className="font-medium">{option.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.requiresManualUrl || !option.instanceUrl
                                ? "enter your brightspace url manually"
                                : new URL(option.instanceUrl).hostname}
                            </span>
                          </span>
                          {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                      );
                    })}

                    <div className="border-t">
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary",
                          selectedUniversityId === "other" ? "bg-secondary/40" : ""
                        )}
                        onClick={() => {
                          setSelectedUniversityId("other");
                          setCustomInstanceUrl("");
                          setIsDropdownOpen(false);
                        }}
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                          <Globe className="h-4 w-4" />
                        </div>
                        <span className="flex flex-1 flex-col leading-tight">
                          <span className="font-medium">other d2l instance</span>
                          <span className="text-xs text-muted-foreground">
                            enter your school url manually
                          </span>
                        </span>
                        {selectedUniversityId === "other" ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : null}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {selectedUniversityId === "other" || selectedUniversity?.requiresManualUrl ? (
            <div className="space-y-2">
              <Label htmlFor="instanceUrl">d2l instance url</Label>
              <Input
                id="instanceUrl"
                name="instanceUrl"
                placeholder="https://yourschool.brightspace.com"
                value={customInstanceUrl}
                onChange={(event) => setCustomInstanceUrl(event.target.value)}
                disabled={isSubmitting}
                autoComplete="url"
              />
            </div>
          ) : null}

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>unable to connect</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Button className="w-full" disabled={!canSubmit || isSubmitting} type="submit">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {isSubmitting ? "connecting and preparing workspace..." : "connect brightspace"}
          </Button>

          {isSubmitting ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-medium text-foreground">setting up your workspace</p>
              <p className="mt-1 text-xs text-muted-foreground">
                this can take a few seconds after the Brightspace window closes.
              </p>
              {progressStepIndex >= 2 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  login complete. finishing account verification and workspace startup.
                </p>
              ) : null}
              {elapsedSeconds >= 12 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  still working... clarus is finishing your connection.
                </p>
              ) : null}
              <div className="mt-3 space-y-2">
                {CONNECT_PROGRESS_STEPS.map((step, index) => {
                  const isComplete = index < progressStepIndex;
                  const isActive = index === progressStepIndex;

                  return (
                    <div key={step.title} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5">
                        {isComplete ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : isActive ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />
                        )}
                      </span>
                      <div>
                        <p className={cn("font-medium", isComplete || isActive ? "text-foreground" : "text-muted-foreground")}>
                          {step.title}
                        </p>
                        <p className="text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
