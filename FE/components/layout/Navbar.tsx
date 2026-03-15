"use client";

import { ChevronDown, ExternalLink, Loader2, LogOut, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError, disconnectD2L, getClarusProfile, getD2LProfile, logoutClarus, type D2LProfileResponse } from "@/lib/api";
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
  const [hasClarusAccount, setHasClarusAccount] = useState(false);

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

    // Check Clarus account status in parallel (non-blocking)
    getClarusProfile()
      .then((cp) => setHasClarusAccount(cp.hasClarusAccount))
      .catch(() => setHasClarusAccount(false));
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
      if (hasClarusAccount) {
        // Clarus user: sign out of Clarus only (keeps D2L state on server, session ends)
        await logoutClarus();
      } else {
        // Guest: disconnect D2L and clear session entirely
        await disconnectD2L();
      }
      toast.success("Signed out");
      router.push("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign out failed";
      toast.error("Sign out failed", { description: message });
    } finally {
      setIsSigningOut(false);
    }
  }

  const isConnected = profile?.connected === true;
  const d2lHomeUrl = profile?.profile.d2lHomeUrl ?? null;
  const canOpenD2L = Boolean(d2lHomeUrl);

  return (
    <header className="pointer-events-none fixed right-4 top-4 z-50 md:right-6 md:top-5">
      <div className="flex items-center">
        {/* Page title slot — reserved for future breadcrumb */}
      </div>

      <div ref={menuRef} className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="flex h-9 items-center gap-2 rounded-full border border-border/80 bg-surface-1/90 px-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-md transition-[background-color] duration-150 hover:bg-surface-2/95"
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
          <div className="absolute right-0 z-[60] mt-2 w-72 overflow-hidden rounded-md border border-border bg-surface-2 shadow-[0_0_0_1px_hsl(0_0%_100%/0.06),_0_8px_24px_rgba(0,0,0,0.55),_0_24px_60px_rgba(0,0,0,0.30)]">
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
                    {isLoadingProfile ? "Checking..." : isConnected ? "Connected" : "Session not connected"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-foreground transition-[background-color] duration-150 hover:bg-surface-3/80"
                onClick={() => {
                  setIsMenuOpen(false);
                  router.push("/dashboard/settings");
                }}
              >
                <span>Settings</span>
                <Settings2 className="h-4 w-4" />
              </button>

              <a
                href={canOpenD2L ? d2lHomeUrl ?? undefined : undefined}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-[background-color] duration-150",
                  canOpenD2L
                    ? "text-foreground hover:bg-surface-3/80"
                    : "cursor-not-allowed text-muted-foreground/60"
                )}
                onClick={() => {
                  if (!canOpenD2L) {
                    return;
                  }

                  setIsMenuOpen(false);
                }}
              >
                <span>Go to D2L homepage</span>
                <ExternalLink className="h-4 w-4" />
              </a>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-foreground transition-[background-color] duration-150 hover:bg-surface-3/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
                {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
