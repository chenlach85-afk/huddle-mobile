import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { useI18n, type Language } from "@/lib/i18n";
import { useCurrentUser, useUpdateSettings } from "@/lib/useCurrentUser";
import { useTheme, type Theme } from "@/lib/useTheme";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Bell, Globe, Shield, User, Monitor, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES: { value: Language; flag: string; native: string }[] = [
  { value: "en", flag: "🇺🇸", native: "English" },
  { value: "he", flag: "🇮🇱", native: "עברית" },
  { value: "es", flag: "🇪🇸", native: "Español" },
];

const REMINDER_OPTIONS = [
  { value: "15", labelKey: "mins15" as const },
  { value: "30", labelKey: "mins30" as const },
  { value: "60", labelKey: "hour1" as const },
  { value: "1440", labelKey: "day1" as const },
];

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { appUser } = useCurrentUser();
  const { user, signOut } = useAuth();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const s = t.settings;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState("30");

  useEffect(() => {
    if (appUser) {
      setNotificationsEnabled(appUser.notificationsEnabled);
      setEmailNotifications(appUser.emailNotifications);
      setPushNotifications(appUser.pushNotifications);
      setReminderMinutes(appUser.calendarReminderMinutes);
    }
  }, [appUser]);

  const handleLanguageChange = async (lang: Language) => {
    setLanguage(lang);
    try {
      await updateSettings.mutateAsync({ language: lang });
      toast({ title: s.languageChanged });
    } catch {
      toast({ title: t.common.error, variant: "destructive" });
    }
  };

  const handleSaveNotifications = async () => {
    try {
      await updateSettings.mutateAsync({
        notificationsEnabled,
        emailNotifications,
        pushNotifications,
        calendarReminderMinutes: reminderMinutes,
      });
      toast({ title: s.settingsSaved });
    } catch {
      toast({ title: t.common.error, variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    if (window.confirm(s.signOutConfirm)) {
      await signOut();
    }
  };

  const displayName = appUser?.name ?? user?.email?.split("@")[0] ?? "—";
  const displayEmail = appUser?.email ?? user?.email ?? "—";
  const initials = displayName !== "—" ? displayName.charAt(0).toUpperCase() : "?";

  const { theme, setTheme } = useTheme();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="mb-2">
        <h1 className="font-display text-3xl text-foreground tracking-wide">{s.title}</h1>
      </div>

      {/* ── PROFILE ── */}
      <SectionCard icon={<User className="h-4 w-4 text-primary" />} title={s.profile}>
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-border shadow-lg bg-primary/20 flex items-center justify-center shrink-0">
            <span className="font-display text-3xl text-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0 pt-1 space-y-0.5">
            <p className="font-semibold text-foreground text-base leading-tight">{displayName}</p>
            <p className="text-muted-foreground text-sm break-all leading-snug">{displayEmail}</p>
            {appUser?.role && (
              <p className="text-xs text-primary font-semibold capitalize">{appUser.role}</p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── LANGUAGE ── */}
      <SectionCard icon={<Globe className="h-4 w-4 text-primary" />} title={s.language}>
        <div className="grid grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => handleLanguageChange(lang.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all",
                language === lang.value
                  ? "border-primary/60 bg-primary/12 text-primary shadow-sm shadow-primary/20"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="text-sm font-bold">{lang.native}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── APPEARANCE ── */}
      <SectionCard icon={<Monitor className="h-4 w-4 text-primary" />} title={s.appearance}>
        <div className="grid grid-cols-3 gap-3">
          {([
            { value: "dark" as Theme, label: s.themeDark, icon: Moon },
            { value: "light" as Theme, label: s.themeLight, icon: Sun },
            { value: "system" as Theme, label: s.themeSystem, icon: Monitor },
          ] as { value: Theme; label: string; icon: React.ElementType }[]).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all",
                theme === value
                  ? "border-primary/60 bg-primary/12 text-primary shadow-sm shadow-primary/20"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-bold">{label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── NOTIFICATIONS ── */}
      <SectionCard icon={<Bell className="h-4 w-4 text-primary" />} title={s.notifications}>
        <div className="space-y-5">
          <ToggleRow id="notif-enabled" label={s.notificationsEnabled} checked={notificationsEnabled} onChange={setNotificationsEnabled} />
          <div className={cn("space-y-4 transition-opacity", !notificationsEnabled && "opacity-40 pointer-events-none")}>
            <ToggleRow id="email-notif" label={s.emailNotifications} checked={emailNotifications} onChange={setEmailNotifications} />
            <ToggleRow id="push-notif" label={s.pushNotifications} checked={pushNotifications} onChange={setPushNotifications} />
            <div>
              <Label className="text-foreground/75 text-sm mb-2 block">{s.reminderBefore}</Label>
              <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                <SelectTrigger className="bg-muted border-border text-foreground w-44" dir="ltr">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {REMINDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {s[opt.labelKey]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleSaveNotifications}
            disabled={updateSettings.isPending}
            className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl"
          >
            {updateSettings.isPending ? t.common.loading : t.common.save}
          </Button>
        </div>
      </SectionCard>

      {/* ── SIGN OUT ── */}
      <div className="pt-2 pb-6">
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 h-11 font-semibold gap-2"
        >
          <LogOut className="h-4 w-4" />
          {t.common.signOut}
        </Button>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border overflow-hidden bg-card">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <h2 className="font-semibold text-card-foreground text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ToggleRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor={id} className="flex-1 text-foreground/80 text-sm cursor-pointer leading-snug">{label}</Label>
      <div dir="ltr" className="shrink-0">
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
