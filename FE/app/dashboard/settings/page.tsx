"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarSync,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  Moon,
  Pencil,
  RefreshCcw,
  ShieldCheck,
  Sun,
  Trash2,
  Unlink,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_UI_SETTINGS,
  type AccentColor,
  type OptimizerPreferencePromptFrequency,
  type UiSettings,
  applyUiSettings,
  loadAndApplyUiSettings,
  writeUiSettings
} from "@/lib/uiSettings";
import {
  ApiError,
  type CalendarFeedAccessResponse,
  type ClarusProfileResponse,
  changeClarusPassword,
  deleteClarusAccount,
  disconnectD2L,
  getCalendarFeedAccess,
  getClarusProfile,
  getD2LStatus,
  updateClarusProfile
} from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Theme Card ───────────────────────────────────────────────────────────────

const ACCENT_SWATCHES: { value: AccentColor; label: string; swatchClass: string }[] = [
  { value: "default", label: "Default",  swatchClass: "bg-[hsl(0_0%_72%)]" },
  { value: "teal",    label: "Teal",     swatchClass: "bg-[hsl(173_60%_55%)]" },
  { value: "violet",  label: "Violet",   swatchClass: "bg-[hsl(258_65%_65%)]" },
  { value: "amber",   label: "Amber",    swatchClass: "bg-[hsl(38_80%_55%)]" },
];

const OPTIMIZER_PROMPT_FREQUENCY_OPTIONS: Array<{
  value: OptimizerPreferencePromptFrequency;
  label: string;
  hint: string;
}> = [
  { value: "daily", label: "Every day", hint: "Reconfirm preferences every 24 hours." },
  { value: "weekly", label: "Every week", hint: "Reconfirm preferences every 7 days." },
  { value: "biweekly", label: "Every 2 weeks", hint: "Reconfirm preferences every 14 days." },
  { value: "monthly", label: "Every month", hint: "Reconfirm preferences every 30 days." },
  { value: "never", label: "Never", hint: "Keep current preferences until you edit manually." }
];

function ThemeCard(props: {
  settings: UiSettings;
  onSetTheme: (t: UiSettings["theme"]) => void;
  onSetAccent: (a: AccentColor) => void;
}) {
  const { settings, onSetTheme, onSetAccent } = props;

  const badgeLabel =
    settings.theme === "dark" ? "Dark" : "Light";
  const accentLabel =
    settings.accent !== "default"
      ? ` · ${settings.accent.charAt(0).toUpperCase() + settings.accent.slice(1)}`
      : "";

  return (
    <Card className="card-glow">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Theme</CardTitle>
          <Badge variant="secondary">
            {badgeLabel}
            {accentLabel && <span className="ml-1 opacity-70">{accentLabel}</span>}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSetTheme("dark")}
            className={cn(
              "rounded-lg border px-4 py-4 text-left transition-colors",
              settings.theme === "dark"
                ? "border-primary/45 bg-primary/15"
                : "border-border bg-secondary/20 hover:bg-secondary/35"
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <p className="font-medium">Dark</p>
            </div>
            <p className="text-xs text-muted-foreground">Black background with light text.</p>
          </button>

          <button
            type="button"
            onClick={() => onSetTheme("light")}
            className={cn(
              "rounded-lg border px-4 py-4 text-left transition-colors",
              settings.theme === "light"
                ? "border-primary/45 bg-primary/15"
                : "border-border bg-secondary/20 hover:bg-secondary/35"
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <p className="font-medium">Light</p>
            </div>
            <p className="text-xs text-muted-foreground">White background with dark text.</p>
          </button>
        </div>

        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Accent Color
          </p>
          <div className="flex items-center gap-2">
            {ACCENT_SWATCHES.map(({ value, label, swatchClass }) => {
              const isActive = settings.accent === value;
              return (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={`${label} accent${isActive ? " (active)" : ""}`}
                  onClick={() => onSetAccent(value)}
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "hover:scale-110"
                  )}
                >
                  <span className={cn("h-5 w-5 rounded-full", swatchClass)} />
                  {isActive && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <Check className="h-3 w-3 drop-shadow-sm" style={{ color: value === "amber" ? "#1a1000" : "white" }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OptimizerPreferencesCard(props: {
  settings: UiSettings;
  onSetFrequency: (frequency: OptimizerPreferencePromptFrequency) => void;
}) {
  const { settings, onSetFrequency } = props;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isDropdownOpen]);

  const selectedOption =
    OPTIMIZER_PROMPT_FREQUENCY_OPTIONS.find(
      (option) => option.value === settings.optimizerPreferencePromptFrequency
    ) ?? OPTIMIZER_PROMPT_FREQUENCY_OPTIONS[1];

  return (
    <Card className="card-glow">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Study Plan Optimizer</CardTitle>
          <Badge variant="secondary">
            {selectedOption?.label ?? "Every week"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose how often Clarus should ask you to resubmit optimizer preferences.
        </p>
        <div className="space-y-2" ref={dropdownRef}>
          <Label htmlFor="optimizer-frequency" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resubmission frequency
          </Label>
          <button
            id="optimizer-frequency"
            type="button"
            onClick={() => setIsDropdownOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{selectedOption.label}</span>
              <span className="text-xs text-muted-foreground">{selectedOption.hint}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {isDropdownOpen ? (
            <div className="relative">
              <div className="absolute left-0 z-50 mt-2 w-full overflow-hidden rounded-md border border-border bg-card shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                <div className="max-h-72 overflow-auto">
                  {OPTIMIZER_PROMPT_FREQUENCY_OPTIONS.map((option) => {
                    const isSelected = option.value === settings.optimizerPreferencePromptFrequency;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10",
                          isSelected ? "bg-primary/15" : ""
                        )}
                        onClick={() => {
                          onSetFrequency(option.value);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <span className="flex flex-1 flex-col leading-tight">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.hint}</span>
                        </span>
                        {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Calendar Card ────────────────────────────────────────────────────────────

function CalendarCard() {
  const [calendarFeed, setCalendarFeed] = useState<CalendarFeedAccessResponse | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  const loadCalendarFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const payload = await getCalendarFeedAccess();
      setCalendarFeed(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load calendar integration";
      toast.error("Calendar integration unavailable", { description: message });
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendarFeed();
  }, [loadCalendarFeed]);

  async function copyFeedUrl() {
    if (!calendarFeed?.feedUrl) return;
    try {
      await navigator.clipboard.writeText(calendarFeed.feedUrl);
      toast.success("Calendar feed URL copied");
    } catch {
      toast.error("Unable to copy URL", {
        description: "Copy is blocked in this browser context. Select and copy manually."
      });
    }
  }

  function preferredWebcalUrl(feed: CalendarFeedAccessResponse): string {
    try {
      const parsed = new URL(feed.webcalUrl || feed.feedUrl);
      if (parsed.protocol === "webcal:") return parsed.toString();
      return `webcal://${parsed.host}${parsed.pathname}${parsed.search}`;
    } catch {
      return feed.webcalUrl;
    }
  }

  function isLocalFeed(feed: CalendarFeedAccessResponse): boolean {
    try {
      const parsed = new URL(feed.feedUrl);
      return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
    } catch {
      return false;
    }
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarSync className="h-4 w-4 text-primary" />
            Calendar Integration
          </CardTitle>
          <Badge variant="secondary">Auto-updating feed</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Subscribe your Google, Apple, or Outlook calendar to your Clarus feed. Clarus updates this feed whenever
          your timeline is synced.
        </p>

        {isLoadingFeed ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing subscription link...
          </div>
        ) : calendarFeed ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subscription URL</p>
              <Input value={calendarFeed.feedUrl} readOnly className="font-mono text-xs" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void copyFeedUrl()}>
                <Copy className="h-4 w-4" />
                Copy URL
              </Button>
              {isLocalFeed(calendarFeed) ? (
                <a
                  href={calendarFeed.feedUrl}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open feed URL
                </a>
              ) : (
                <a
                  href={preferredWebcalUrl(calendarFeed)}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in calendar app
                </a>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => void loadCalendarFeed()}>
                <RefreshCcw className="h-4 w-4" />
                Refresh link
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Link expires on {new Date(calendarFeed.expiresAt).toLocaleString()}.
            </p>
          </>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadCalendarFeed()}>
            <RefreshCcw className="h-4 w-4" />
            Generate link
          </Button>
        )}

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Google Calendar: Add calendar from URL and paste the subscription link.</p>
          {calendarFeed && isLocalFeed(calendarFeed) ? (
            <p>Apple Calendar (localhost): Copy URL, then use File, New Calendar Subscription, and paste the link.</p>
          ) : (
            <p>Apple Calendar: File, New Calendar Subscription, then paste the link.</p>
          )}
          <p>Outlook: Add calendar, Subscribe from web, then paste the link.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard(props: { profile: ClarusProfileResponse; onNameUpdated: (name: string) => void }) {
  const { profile, onNameUpdated } = props;
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nameInput.trim() || saving) return;
    setSaving(true);
    try {
      await updateClarusProfile({ name: nameInput.trim() });
      toast.success("Display name updated");
      onNameUpdated(nameInput.trim());
      setEditing(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update name";
      toast.error("Update failed", { description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display name</p>
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                disabled={saving}
                className="h-8 text-sm"
                autoFocus
              />
              <Button size="sm" variant="default" onClick={() => void handleSave()} disabled={saving || !nameInput.trim()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setNameInput(profile.name ?? ""); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm">{profile.name ?? <span className="text-muted-foreground">Not set</span>}</p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Edit display name"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">University</p>
          <p className="text-sm text-muted-foreground">{profile.university ?? "Not set"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Change Password Card ─────────────────────────────────────────────────────

function ChangePasswordCard() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = currentPw.length > 0 && newPw.length >= 8 && newPw === confirmPw;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await changeClarusPassword({ currentPassword: currentPw, newPassword: newPw });
      toast.success("Password updated");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to change password";
      toast.error("Password change failed", { description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="text-base">Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="current-pw">Current password</Label>
            <Input
              id="current-pw"
              type="password"
              placeholder="••••••••"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              disabled={saving}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              placeholder="At least 8 characters"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <Input
              id="confirm-pw"
              type="password"
              placeholder="••••••••"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
            {confirmPw.length > 0 && newPw !== confirmPw ? (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            ) : null}
          </div>
          <Button type="submit" size="sm" disabled={!canSave || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {saving ? "Updating..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── D2L Connection Card ──────────────────────────────────────────────────────

function D2LConnectionCard() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getD2LStatus();
      setConnected(status.connected);
      setLastVerifiedAt(status.connected ? status.lastVerifiedAt : null);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      await disconnectD2L();
      toast.success("Brightspace disconnected");
      setConnected(false);
      setLastVerifiedAt(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to disconnect";
      toast.error("Disconnect failed", { description: msg });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card className="card-glow">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Brightspace Connection</CardTitle>
          {!loading ? (
            <Badge variant={connected ? "secondary" : "destructive"} className={connected ? "bg-primary/20 text-primary" : ""}>
              {connected ? "Connected" : "Disconnected"}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection...
          </div>
        ) : (
          <>
            {connected && lastVerifiedAt ? (
              <p className="text-sm text-muted-foreground">
                Last verified: {new Date(lastVerifiedAt).toLocaleString()}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active Brightspace session. Return to the{" "}
                <Link href="/login" className="text-primary underline-offset-2 hover:underline">
                  login page
                </Link>{" "}
                to reconnect.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void loadStatus()} disabled={loading}>
                <RefreshCcw className="h-4 w-4" />
                Refresh status
              </Button>
              {connected ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                >
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                  {disconnecting ? "Disconnecting..." : "Disconnect Brightspace"}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Delete Account Card ──────────────────────────────────────────────────────

function DeleteAccountCard() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const CONFIRM_PHRASE = "delete my account";
  const canDelete = confirmText.toLowerCase() === CONFIRM_PHRASE;

  async function handleDelete() {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteClarusAccount();
      toast.success("Account deleted");
      router.push("/login");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to delete account";
      toast.error("Delete failed", { description: msg });
      setDeleting(false);
    }
  }

  return (
    <Card className="card-glow border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Permanently deletes your Clarus account and all associated data — courses, events, study plans, and settings.
          This cannot be undone.
        </p>

        <div className="space-y-2">
          <Label htmlFor="delete-confirm" className="text-sm">
            Type <span className="font-mono text-foreground">{CONFIRM_PHRASE}</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            disabled={deleting}
            className="border-destructive/40 focus-visible:ring-destructive"
          />
        </div>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => void handleDelete()}
          disabled={!canDelete || deleting}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {deleting ? "Deleting account..." : "Delete my account"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS);
  const [clarusProfile, setClarusProfile] = useState<ClarusProfileResponse | null>(null);

  useEffect(() => {
    setSettings(loadAndApplyUiSettings());
  }, []);

  useEffect(() => {
    getClarusProfile()
      .then(setClarusProfile)
      .catch(() => setClarusProfile(null));
  }, []);

  function setTheme(theme: UiSettings["theme"]) {
    const next = { ...settings, theme };
    setSettings(next);
    writeUiSettings(next);
    applyUiSettings(next);
  }

  function setAccent(accent: AccentColor) {
    const next = { ...settings, accent };
    setSettings(next);
    writeUiSettings(next);
    applyUiSettings(next);
  }

  function setOptimizerPreferencePromptFrequency(frequency: OptimizerPreferencePromptFrequency) {
    const next = { ...settings, optimizerPreferencePromptFrequency: frequency };
    setSettings(next);
    writeUiSettings(next);
    applyUiSettings(next);
  }

  const hasClarusAccount = clarusProfile?.hasClarusAccount === true;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your account, theme, and integrations.</p>
        </div>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>

      {hasClarusAccount && clarusProfile ? (
        <ProfileCard
          profile={clarusProfile}
          onNameUpdated={(name) => setClarusProfile((prev) => (prev ? { ...prev, name } : prev))}
        />
      ) : null}

      <ThemeCard settings={settings} onSetTheme={setTheme} onSetAccent={setAccent} />

      <OptimizerPreferencesCard
        settings={settings}
        onSetFrequency={setOptimizerPreferencePromptFrequency}
      />

      <CalendarCard />

      <D2LConnectionCard />

      {hasClarusAccount ? <ChangePasswordCard /> : null}

      {hasClarusAccount ? <DeleteAccountCard /> : null}
    </div>
  );
}
