"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ApiError, connectD2L } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_INSTANCE_URL =
  process.env.NEXT_PUBLIC_DEFAULT_INSTANCE_URL ?? "https://yourschool.brightspace.com";

export function ConnectForm() {
  const router = useRouter();
  const [instanceUrl, setInstanceUrl] = useState(DEFAULT_INSTANCE_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return instanceUrl.trim().length > 0 && username.trim().length > 0 && password.length > 0;
  }, [instanceUrl, password, username]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await connectD2L({
        instanceUrl,
        username,
        password
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
        <CardTitle>Connect your Brightspace instance</CardTitle>
        <CardDescription>
          hackathon demo: credentials are used only to log in once and are never stored.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="instanceUrl">D2L instance URL</Label>
            <Input
              id="instanceUrl"
              name="instanceUrl"
              placeholder="https://yourschool.brightspace.com"
              value={instanceUrl}
              onChange={(event) => setInstanceUrl(event.target.value)}
              autoComplete="url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">username</Label>
            <Input
              id="username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>unable to connect</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Button className="w-full" disabled={!canSubmit || isSubmitting} type="submit">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {isSubmitting ? "connecting..." : "connect d2l"}
          </Button>

          {isSubmitting ? (
            <p className="text-xs text-muted-foreground">
              if your school uses sso/duo, a browser window may open. complete the prompt to finish
              connecting.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
