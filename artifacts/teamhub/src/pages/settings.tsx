import { useState, useEffect } from "react";
import { useClerk } from "@clerk/react";
import { useI18n, type Language } from "@/lib/i18n";
import { useCurrentUser, useUpdateSettings } from "@/lib/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Bell, Globe, Shield, User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES: { value: Language; label: string; native: string }[] = [
  { value: "en", label: "English", native: "English" },
  { value: "he", label: "Hebrew", native: "עברית" },
  { value: "es", label: "Spanish", native: "Español" },
];

const REMINDER_OPTIONS = [
  { value: "15", labelKey: "mins15" as const },
  { value: "30", labelKey: "mins30" as const },
  { value: "60", labelKey: "hour1" as const },
  { value: "1440", labelKey: "day1" as const },
];

export default function SettingsPage() {
  const { t, language, setLanguage, isRTL } = useI18n();
  const { appUser } = useCurrentUser();
  const updateSettings = useUpdateSettings();
  const { signOut, openUserProfile } = useClerk();
  const { toast } = useToast();

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
      toast({ title: t.settings.languageChanged });
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
      toast({ title: t.settings.settingsSaved });
    } catch {
      toast({ title: t.common.error, variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    if (window.confirm(t.settings.signOutConfirm)) {
      await signOut();
    }
  };

  const sections = [
    { id: "profile", label: t.settings.profile, icon: User },
    { id: "language", label: t.settings.language, icon: Globe },
    { id: "notifications", label: t.settings.notifications, icon: Bell },
    { id: "security", label: t.settings.security, icon: Shield },
  ];

  return (
    <div className={cn("max-w-2xl mx-auto px-4 py-6", isRTL && "text-right")}>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white tracking-wide">{t.settings.title}</h1>
        <p className="text-white/45 text-sm mt-1">{appUser?.email}</p>
      </div>

      <div className="space-y-4">
        {/* Profile Section */}
        <section className="rounded-2xl border border-white/6 overflow-hidden"
          style={{ background: "#161b2e" }}>
          <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-white text-sm">{t.settings.profile}</h2>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
                <span className="font-display text-2xl text-primary">
                  {appUser?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div>
                <p className="font-semibold text-white">{appUser?.name ?? "—"}</p>
                <p className="text-white/45 text-sm">{appUser?.email ?? "—"}</p>
                <p className="text-xs text-primary font-medium capitalize mt-0.5">{appUser?.role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-white/15 text-white/70 hover:text-white hover:bg-white/8"
              onClick={() => openUserProfile()}
            >
              Edit Profile
            </Button>
          </div>
        </section>

        {/* Language Section */}
        <section className="rounded-2xl border border-white/6 overflow-hidden"
          style={{ background: "#161b2e" }}>
          <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-white text-sm">{t.settings.language}</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => handleLanguageChange(lang.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                    language === lang.value
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-white/8 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/80",
                  )}
                >
                  <span className="text-lg font-bold">{lang.native}</span>
                  <span className="text-xs opacity-70">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="rounded-2xl border border-white/6 overflow-hidden"
          style={{ background: "#161b2e" }}>
          <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-white text-sm">{t.settings.notifications}</h2>
          </div>
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-enabled" className="text-white/80 text-sm cursor-pointer">
                {t.settings.notificationsEnabled}
              </Label>
              <Switch
                id="notif-enabled"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>
            <div className={cn("space-y-4 transition-opacity", !notificationsEnabled && "opacity-40 pointer-events-none")}>
              <div className="flex items-center justify-between">
                <Label htmlFor="email-notif" className="text-white/80 text-sm cursor-pointer">
                  {t.settings.emailNotifications}
                </Label>
                <Switch
                  id="email-notif"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="push-notif" className="text-white/80 text-sm cursor-pointer">
                  {t.settings.pushNotifications}
                </Label>
                <Switch
                  id="push-notif"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
              <div>
                <Label className="text-white/80 text-sm mb-2 block">
                  {t.settings.reminderBefore}
                </Label>
                <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#1f2742" }}>
                    {REMINDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-white/8">
                        {t.settings[opt.labelKey]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleSaveNotifications}
              disabled={updateSettings.isPending}
              className="bg-primary hover:bg-primary/90 text-white font-semibold"
            >
              {updateSettings.isPending ? t.common.loading : t.common.save}
            </Button>
          </div>
        </section>

        {/* Security Section */}
        <section className="rounded-2xl border border-white/6 overflow-hidden"
          style={{ background: "#161b2e" }}>
          <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-white text-sm">{t.settings.security}</h2>
          </div>
          <div className="p-5 space-y-3">
            <button
              onClick={() => openUserProfile()}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-white/8 hover:border-white/20 hover:bg-white/4 transition-all text-left"
            >
              <span className="text-white/80 text-sm">{t.settings.changePassword}</span>
              <ChevronRight className="h-4 w-4 text-white/30" />
            </button>
          </div>
        </section>

        {/* Sign Out */}
        <div className="pt-2">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 h-11 font-semibold"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t.common.signOut}
          </Button>
        </div>
      </div>
    </div>
  );
}
