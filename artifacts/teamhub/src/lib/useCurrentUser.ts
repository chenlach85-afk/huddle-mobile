import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { apiFetchJson } from "@/lib/apiFetch";

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

export function useCurrentUser() {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data: appUser, isLoading, error, refetch } = useQuery<AppUser>({
    queryKey: ["auth-me"],
    queryFn: () => apiFetchJson<AppUser>("/api/auth/me"),
    enabled: !!token,
    retry: false,
  });

  return { appUser, isLoading: !session && isLoading, error, refetch };
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<AppUser> & { name?: string }) =>
      apiFetchJson<AppUser>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
  });
}
