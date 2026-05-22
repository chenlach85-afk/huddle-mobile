import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { syncUser } from "@/lib/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import type { AppUser } from "@/lib/useCurrentUser";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function autoAcceptInvitation(token: string): Promise<AppUser | null> {
  try {
    const res = await fetch(`${BASE}/api/invitations/auto-accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AppUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export function UserSync() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { setLanguage } = useI18n();
  const synced = useRef(false);

  useEffect(() => {
    if (!user || !session || synced.current) return;
    synced.current = true;

    const email = user.email ?? "";
    const name = (user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0] ?? "Coach";
    const token = session.access_token;

    syncUser(token, { email, name, role: "coach" })
      .then((appUser) => {
        queryClient.setQueryData(["auth-me"], appUser);
        if (appUser.language) {
          setLanguage(appUser.language as "en" | "he" | "es");
        }
      })
      .catch(async () => {
        const appUser = await autoAcceptInvitation(token);
        if (appUser) {
          queryClient.setQueryData(["auth-me"], appUser);
          if (appUser.language) {
            setLanguage(appUser.language as "en" | "he" | "es");
          }
        } else {
          queryClient.invalidateQueries({ queryKey: ["auth-me"] });
        }
      });
  }, [user, session, queryClient, setLanguage]);

  return null;
}
