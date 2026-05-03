import { useState, useEffect, useRef } from "react";
import { useClerk, useUser } from "@clerk/react";
import { useI18n, type Language } from "@/lib/i18n";
import { useCurrentUser, useUpdateSettings } from "@/lib/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Bell, Globe, Shield, User, ChevronRight, Camera, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES: { value: Language; label: string; native: string; flag: string }[] = [
  { value: "en", label: "English", native: "English", flag: "🇺🇸" },
  { value: "he", label: "עברית", native: "עברית", flag: "🇮🇱" },
  { value: "es", label: "Español", native: "Español", flag: "🇪🇸" },
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
  const { user: clerkUser } = useUser();
  const updateSettings = useUpdateSettings();
  const { signOut, openUserProfile } = useClerk();
  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const s = t.settings;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState("30");
  const [photoUploading, setPhotoUploading] = useState(false);

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

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clerkUser) return;
    setPhotoUploading(true);
    try {
      await clerkUser.setProfileImage({ file });
      toast({ title: s.photoUpdated });
    } catch {
      toast({ title: s.photoFailed, variant: "destructive" });
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const avatarUrl = clerkUser?.imageUrl;
  const displayName = appUser?.name ?? clerkUser?.fullName ?? "—";
  const displayEmail = appUser?.email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? "—";
  const initials = displayName !== "—" ? displayName.charAt(0).toUpperCase() : "?";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white tracking-wide">{s.title}</h1>
        <p className="text-white/40 text-sm mt-1 break-all">{displayEmail}</p>
      </div>

      <div className="space-y-4">

        {/* ── Profile Section ── */}
        <section className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "#161b2e" }}>
          <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
            <User className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-semibold text-white text-sm">{s.profile}</h2>
          </div>
          <div className="p-5">
            {/* Avatar + info row */}
            <div className="flex items-start gap-4">
              {/* Avatar with upload overlay */}
              <div className="relative shrink-0 group">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                      <span className="font-display text-3xl text-primary">{initials}</span>
                    </div>
                  )}
                </div>
                {/* Camera overlay on hover */}
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={s.changePhoto}
                >
                  {photoUploading ? (
                    <div className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </button>
              </div>

              {/* Name / email / role info */}
              <div className="flex-1 min-w-0 pt-1">
                <p className="font-semibold text-white text-base leading-tight">{displayName}</p>
                <p className="text-white/45 text-sm mt-0.5 break-all leading-snug">{displayEmail}</p>
                <p className="text-xs text-primary font-semibold capitalize mt-1">{appUser?.role}</p>
              </div>
            </div>

            {/* Action buttons row */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="border-white/15 text-white/70 hover:text-white hover:bg-white/8 gap-1.5"
                onClick={() => openUserProfile()}
              >
                <Pencil className="h-3.5 w-3.5" />
                {s.editProfile}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/15 text-white/70 hover:text-white hover:bg-white/8 gap-1.5"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
              >
                <Camera className="h-3.5 w-3.5" />
                {photoUploading ? s.uploading : s.uploadPhoto}
              </Button>
            </div>
          </div>
        </section>

        {/* ── Language Section ── */}
        <section className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "#161b2e" }}>
          <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-semibold text-white text-sm">{s.language}</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => handleLanguageChange(lang.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                    language === lang.value
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-white/8 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/80"
                  )}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="text-sm font-bold">{lang.native}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Notifications Section ── */}
        <section className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "#161b2e" }}>
          <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-semibold text-white text-sm">{s.notifications}</h2>
          </div>
          <div className="p-5 space-y-5">
            {/* Each toggle row: label on the logical-start side, switch on logical-end */}
            <ToggleRow
              id="notif-enabled"
              label={s.notificationsEnabled}
              checked={notificationsEnabled}
              onChange={setNotificationsEnabled}
            />

            <div className={cn("space-y-4 transition-opacity", !notificationsEnabled && "opacity-40 pointer-events-none")}>
              <ToggleRow
                id="email-notif"
                label={s.emailNotifications}
                checked={emailNotifications}
                onChange={setEmailNotifications}
              />
              <ToggleRow
                id="push-notif"
                label={s.pushNotifications}
                checked={pushNotifications}
                onChange={setPushNotifications}
              />

              <div>
                <Label className="text-white/80 text-sm mb-2 block">
                  {s.reminderBefore}
                </Label>
                <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white w-48 ltr-num" dir="ltr">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#1f2742" }}>
                    {REMINDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-white/8">
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
              className="bg-primary hover:bg-primary/90 text-white font-semibold"
            >
              {updateSettings.isPending ? t.common.loading : t.common.save}
            </Button>
          </div>
        </section>

        {/* ── Security Section ── */}
        <section className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "#161b2e" }}>
          <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-semibold text-white text-sm">{s.security}</h2>
          </div>
          <div className="p-5 space-y-3">
            <button
              onClick={() => openUserProfile()}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-white/8 hover:border-white/20 hover:bg-white/4 transition-all text-start"
            >
              <span className="text-white/80 text-sm">{s.changePassword}</span>
              <ChevronRight className="h-4 w-4 text-white/30 shrink-0 flip-rtl" />
            </button>
            <button
              onClick={() => openUserProfile()}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-white/8 hover:border-white/20 hover:bg-white/4 transition-all text-start"
            >
              <span className="text-white/80 text-sm">{s.manageAccount}</span>
              <ChevronRight className="h-4 w-4 text-white/30 shrink-0 flip-rtl" />
            </button>
          </div>
        </section>

        {/* ── Sign Out ── */}
        <div className="pt-2">
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
    </div>
  );
}

/** RTL-aware toggle row: label on the text-start side, switch fixed to the end */
function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor={id} className="flex-1 text-white/80 text-sm cursor-pointer leading-snug">
        {label}
      </Label>
      {/* Keep the switch visually LTR so the thumb direction is intuitive */}
      <div dir="ltr" className="shrink-0">
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
