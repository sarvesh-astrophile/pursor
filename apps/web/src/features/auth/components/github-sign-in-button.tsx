import { Button } from "@pursor/ui/components/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "../client";

export default function GitHubSignInButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const [isPending, setIsPending] = useState(false);
  const [hasOAuthError, setHasOAuthError] = useState(false);

  useEffect(() => {
    setHasOAuthError(new URLSearchParams(window.location.search).has("error"));
  }, []);

  async function signIn() {
    setIsPending(true);

    try {
      const { error } = await authClient.signIn.social({
        provider: "github",
        callbackURL: redirectTo,
        errorCallbackURL: `/login?redirect=${encodeURIComponent(redirectTo)}`,
      });

      if (error) {
        toast.error(error.message || "Unable to sign in with GitHub. Please try again.");
        setIsPending(false);
      }
    } catch {
      toast.error("Unable to connect to GitHub sign-in. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {hasOAuthError && (
        <p role="alert" className="text-sm text-destructive">
          GitHub sign-in was cancelled or could not be completed. Please try again.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isPending}
        aria-busy={isPending}
        onClick={signIn}
      >
        {isPending ? "Redirecting to GitHub..." : "Continue with GitHub"}
      </Button>
    </div>
  );
}
