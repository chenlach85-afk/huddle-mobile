import { useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { syncUser } from "@/lib/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import type { AppUser } from "@/lib/useCurrentUser";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function autoAcceptInvitation(): Promise<AppUser | null> {
  try {
    const res = await fetch(`${BASE}/api/invitations/auto-accept`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AppUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}

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
      .catch(async () => {
        // Sync failed (403 = invitation-only). Try to auto-accept any pending
        // invitation for this user's email — handles the case where Clerk
        // redirected them away from the /invite page before they could click Accept.
        const appUser = await autoAcceptInvitation();
        if (appUser) {
          queryClient.setQueryData(["auth-me"], appUser);
          if (appUser.language) {
            setLanguage(appUser.language as "en" | "he" | "es");
          }
        } else {
          // No pending invitation found — show not-activated screen
          queryClient.invalidateQueries({ queryKey: ["auth-me"] });
        }
      });
  }, [isLoaded, user, queryClient, setLanguage]);

  return null;
}
