import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import type { AppUser } from "@/lib/useCurrentUser";
import { apiFetchJson } from "@/lib/apiFetch";

export function UserSync() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { setLanguage } = useI18n();
  const synced = useRef(false);

  useEffect(() => {
    if (!user || !session || synced.current) return;
    synced.current = true;

    apiFetchJson<AppUser>("/api/auth/me")
      .then((appUser) => {
        queryClient.setQueryData(["auth-me"], appUser);
        if (appUser.language) {
          setLanguage(appUser.language as "en" | "he" | "es");
        }
      })
      .catch(() => {
        queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      });
  }, [user, session, queryClient, setLanguage]);

  return null;
}
