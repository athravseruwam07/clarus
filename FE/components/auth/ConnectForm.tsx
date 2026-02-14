"use client";

import { Check, ChevronDown, Globe, Loader2, ShieldCheck } from "lucide-react";
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

const DEFAULT_INSTANCE_URL =
  process.env.NEXT_PUBLIC_DEFAULT_INSTANCE_URL ?? "https://yourschool.brightspace.com";

type UniversityOption = {
  id: string;
  name: string;
  instanceUrl: string;
};

const CANADIAN_UNIVERSITIES: UniversityOption[] = [
  { id: "waterloo", name: "University of Waterloo", instanceUrl: "https://learn.uwaterloo.ca" },
  { id: "york", name: "York University", instanceUrl: "https://york.brightspace.com" },
  { id: "mcmaster", name: "McMaster University", instanceUrl: "https://avenue.mcmaster.ca" },
  { id: "queens", name: "Queen's University", instanceUrl: "https://onq.queensu.ca" },
  { id: "guelph", name: "University of Guelph", instanceUrl: "https://courselink.uoguelph.ca" },
  { id: "tmu", name: "Toronto Metropolitan University", instanceUrl: "https://d2l.torontomu.ca" }
];

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/$/, "");
}

function faviconUrl(instanceUrl: string): string {
  const hostname = new URL(instanceUrl).hostname;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

function initials(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const letters = parts.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase();
}

function UniversityLogo(props: { name: string; instanceUrl?: string; className?: string }) {
  const { name, instanceUrl, className } = props;
  const [failed, setFailed] = useState(false);

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
      className={cn("h-7 w-7 rounded-md", className)}
      src={faviconUrl(instanceUrl)}
      onError={() => setFailed(true)}
    />
  );
}

export function ConnectForm() {
  const router = useRouter();
  const normalizedDefaultUrl = useMemo(() => normalizeUrl(DEFAULT_INSTANCE_URL), []);
  const defaultMatch = useMemo(() => {
    return CANADIAN_UNIVERSITIES.find(
      (option) => normalizeUrl(option.instanceUrl) === normalizedDefaultUrl
    );
  }, [normalizedDefaultUrl]);

  const [selectedUniversityId, setSelectedUniversityId] = useState<string>(
    defaultMatch?.id ?? "other"
  );
  const [customInstanceUrl, setCustomInstanceUrl] = useState<string>(
    defaultMatch ? defaultMatch.instanceUrl : normalizedDefaultUrl
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await connectD2L({
        instanceUrl: resolvedInstanceUrl,
        mode: "manual"
      });

      toast.success("Connected to D2L", {
        description: "Your command center is ready."
      });
      router.push("/dashboard");
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
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-white/90">
      <CardHeader>
        <CardTitle>Connect your Brightspace</CardTitle>
        <CardDescription>
          hackathon demo: clarus never sees your password. sign in inside the opened d2l tab and we
          store only an encrypted session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2" ref={dropdownRef}>
            <Label>university</Label>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setIsDropdownOpen((open) => !open)}
            >
              <span className="flex items-center gap-2">
                <UniversityLogo
                  name={selectedUniversity?.name ?? "Other"}
                  instanceUrl={selectedUniversity?.instanceUrl}
                />
                <span className="flex flex-col leading-tight">
                  <span className="font-medium">
                    {selectedUniversity?.name ?? "Other (enter instance url)"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selectedUniversity
                      ? new URL(selectedUniversity.instanceUrl).hostname
                      : "paste your school brightspace url"}
                  </span>
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {isDropdownOpen ? (
              <div className="relative">
                <div className="absolute left-0 z-50 mt-2 w-full overflow-hidden rounded-md border bg-white shadow-lg">
                  <div className="max-h-72 overflow-auto">
                    {CANADIAN_UNIVERSITIES.map((option) => {
                      const isSelected = option.id === selectedUniversityId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/60",
                            isSelected ? "bg-secondary/40" : ""
                          )}
                          onClick={() => {
                            setSelectedUniversityId(option.id);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <UniversityLogo name={option.name} instanceUrl={option.instanceUrl} />
                          <span className="flex flex-1 flex-col leading-tight">
                            <span className="font-medium">{option.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new URL(option.instanceUrl).hostname}
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
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/60",
                          selectedUniversityId === "other" ? "bg-secondary/40" : ""
                        )}
                        onClick={() => {
                          setSelectedUniversityId("other");
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

          {selectedUniversityId === "other" ? (
            <div className="space-y-2">
              <Label htmlFor="instanceUrl">d2l instance url</Label>
              <Input
                id="instanceUrl"
                name="instanceUrl"
                placeholder="https://yourschool.brightspace.com"
                value={customInstanceUrl}
                onChange={(event) => setCustomInstanceUrl(event.target.value)}
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
            {isSubmitting ? "connecting..." : "connect your d2l account"}
          </Button>

          {isSubmitting ? (
            <p className="text-xs text-muted-foreground">
              a d2l login window will open. complete sso/duo and it will close automatically once
              clarus captures a session.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
