import { useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { syncUser } from "@/lib/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

export function UserSync() {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const { setLanguage } = useI18n();
  const synced = useRef(false);

  useEffect(() => {
    if (!isLoaded || !user || synced.current) return;
    synced.current = true;

    const email = user.primaryEmailAddress?.emailAddress ?? "";
    const name = user.fullName ?? user.firstName ?? email.split("@")[0] ?? "Coach";

    syncUser({ email, name, role: "coach" })
      .then((appUser) => {
        queryClient.setQueryData(["auth-me"], appUser);
        if (appUser.language) {
          setLanguage(appUser.language as "en" | "he" | "es");
        }
      })
      .catch(() => {
        // Sync failed (e.g. 403 invitation-only) — invalidate so useCurrentUser
        // picks up the 404/error from /api/auth/me and shows the not-activated screen
        queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      });
  }, [isLoaded, user, queryClient, setLanguage]);

  return null;
}
