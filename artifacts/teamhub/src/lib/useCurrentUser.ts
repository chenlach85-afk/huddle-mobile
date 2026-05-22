import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";

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

async function fetchWithAuth(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export async function syncUser(token: string, data: { email: string; name: string; role?: string }): Promise<AppUser> {
  const res = await fetchWithAuth(`${BASE}/api/auth/sync`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to sync user");
  return res.json();
}

export function useCurrentUser() {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data: appUser, isLoading, error, refetch } = useQuery<AppUser>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetchWithAuth(`${BASE}/api/auth/me`, token!);
      if (!res.ok) throw new Error("User not found");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  return { appUser, isLoading: !session && isLoading, error, refetch };
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;

  return useMutation({
    mutationFn: async (data: Partial<AppUser> & { name?: string }) => {
      const res = await fetchWithAuth(`${BASE}/api/auth/me`, token!, {
        method: "PATCH",
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
