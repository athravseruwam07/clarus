"use client";

import { ChevronDown, ExternalLink, Loader2, LogOut } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError, disconnectD2L, getD2LProfile, type D2LProfileResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

function initials(value: string): string {
  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function institutionHost(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function Navbar() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<D2LProfileResponse | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);

    try {
      const response = await getD2LProfile();
      setProfile(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push("/login");
        return;
      }

      setProfile(null);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isMenuOpen]);

  const displayName = profile?.profile.name ?? "D2L account";
  const displayEmail = profile?.profile.email ?? "email unavailable";
  const instanceHost = institutionHost(profile?.profile.institutionUrl);
  const profileInitials = useMemo(() => initials(displayName), [displayName]);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await disconnectD2L();
      toast.success("signed out");
      router.push("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "sign out failed";
      toast.error("sign out failed", { description: message });
    } finally {
      setIsSigningOut(false);
    }
  }

  const isConnected = profile?.connected === true;
  const d2lHomeUrl = profile?.profile.d2lHomeUrl ?? null;
  const canOpenD2L = Boolean(d2lHomeUrl);

  return (
    <header className="relative z-40 flex h-14 items-center justify-between border-b border-border/80 bg-background/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg ring-1 ring-primary/20">
          <Image
            src="/Clarus-logo.svg"
            alt="Clarus logo"
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
        </div>
        <h1 className="text-sm font-semibold tracking-tight">Clarus</h1>
      </div>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="flex h-9 items-center gap-2 rounded-full border border-border/80 bg-secondary/20 px-2.5 transition-colors hover:bg-secondary/40"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label="Open profile menu"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary">
            {profileInitials}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {isMenuOpen ? (
          <div className="absolute right-0 z-[60] mt-2 w-72 overflow-hidden rounded-md border border-border bg-card shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            <div className="border-b border-border px-3 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {profileInitials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                  {instanceHost ? (
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{instanceHost}</p>
                  ) : null}
                  <p
                    className={cn(
                      "mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      isConnected
                        ? "bg-primary/20 text-primary"
                        : "bg-destructive/15 text-destructive"
                    )}
                  >
                    {isLoadingProfile ? "checking..." : isConnected ? "connected" : "session not connected"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2">
              <a
                href={canOpenD2L ? d2lHomeUrl ?? undefined : undefined}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                  canOpenD2L
                    ? "text-foreground hover:bg-secondary/50"
                    : "cursor-not-allowed text-muted-foreground/60"
                )}
                onClick={() => {
                  if (!canOpenD2L) {
                    return;
                  }

                  setIsMenuOpen(false);
                }}
              >
                <span>go to d2l homepage</span>
                <ExternalLink className="h-4 w-4" />
              </a>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{isSigningOut ? "signing out..." : "sign out"}</span>
                {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
