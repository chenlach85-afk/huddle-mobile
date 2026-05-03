import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";

export interface AppUser {
  id: number;
  clerkId: string;
  email: string;
  name: string;
  role: "coach" | "player" | "admin";
  language: "en" | "he" | "es";
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  calendarReminderMinutes: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchCurrentUser(): Promise<AppUser> {
  const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
  if (!res.ok) throw new Error("User not found");
  return res.json();
}

async function syncUser(data: { email: string; name: string; role?: string }): Promise<AppUser> {
  const res = await fetch(`${BASE}/api/auth/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to sync user");
  return res.json();
}

export function useCurrentUser() {
  const { user: clerkUser, isLoaded } = useUser();

  const { data: appUser, isLoading, error, refetch } = useQuery<AppUser>({
    queryKey: ["auth-me"],
    queryFn: fetchCurrentUser,
    enabled: isLoaded && !!clerkUser,
    retry: false,
  });

  return { appUser, isLoading: !isLoaded || isLoading, error, refetch };
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  return useMutation({
    mutationFn: async (data: Partial<AppUser>) => {
      const res = await fetch(`${BASE}/api/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
  });
}

export { syncUser };
