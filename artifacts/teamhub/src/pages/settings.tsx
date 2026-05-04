import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useI18n, type Language } from "@/lib/i18n";
import { useCurrentUser, useUpdateSettings } from "@/lib/useCurrentUser";
import { useTheme, type Theme } from "@/lib/useTheme";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Bell, Globe, Shield, User, Camera, Eye, EyeOff, Sun, Moon, Monitor } from "lucide-react";
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
  const { user: clerkUser } = useUser();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const s = t.settings;

  // ── Notifications state ──
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState("30");

  // ── Password state ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  // ── Photo state ──
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

  const handleChangePassword = async () => {
    setPwError("");
    if (newPassword.length < 8) { setPwError(s.passwordTooShort); return; }
    if (newPassword !== confirmPassword) { setPwError(s.passwordMismatch); return; }
    setPwSaving(true);
    try {
      await clerkUser?.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: false });
      toast({ title: s.passwordChanged });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch {
      setPwError(s.passwordFailed);
    } finally {
      setPwSaving(false);
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

  const handleSignOut = async () => {
    if (window.confirm(s.signOutConfirm)) {
      await clerkUser?.reload();
      window.location.href = "/sign-in";
    }
  };

  const avatarUrl = clerkUser?.imageUrl;
  const displayName = appUser?.name ?? clerkUser?.fullName ?? "—";
  const displayEmail = appUser?.email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? "—";
  const initials = displayName !== "—" ? displayName.charAt(0).toUpperCase() : "?";

  // Detect if the user has a password-based account (not purely OAuth)
  const hasPassword = clerkUser?.passwordEnabled ?? false;
  // Connected OAuth providers
  const oauthAccounts = clerkUser?.externalAccounts ?? [];

  const { theme, setTheme } = useTheme();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

      {/* Page header */}
      <div className="mb-2">
        <h1 className="font-display text-3xl text-foreground tracking-wide">{s.title}</h1>
      </div>

      {/* ── PROFILE ── */}
      <SectionCard icon={<User className="h-4 w-4 text-primary" />} title={s.profile}>
        <div className="flex items-start gap-5">
          {/* Avatar with camera overlay */}
          <div className="relative shrink-0 group cursor-pointer" onClick={() => photoInputRef.current?.click()}>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-border shadow-lg">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                  <span className="font-display text-3xl text-primary">{initials}</span>
                </div>
              )}
            </div>
            <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity">
              {photoUploading
                ? <div className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                : <Camera className="h-5 w-5 text-white" />}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1 space-y-0.5">
            <p className="font-semibold text-foreground text-base leading-tight">{displayName}</p>
            <p className="text-muted-foreground text-sm break-all leading-snug">{displayEmail}</p>
            {appUser?.role && (
              <p className="text-xs text-primary font-semibold capitalize">{appUser.role}</p>
            )}
            {oauthAccounts.length > 0 && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                {s.connectedAccount} {oauthAccounts.map(a => a.provider).join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Upload photo button */}
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-1.5"
          onClick={() => photoInputRef.current?.click()}
          disabled={photoUploading}
        >
          <Camera className="h-3.5 w-3.5" />
          {photoUploading ? s.uploading : s.uploadPhoto}
        </Button>
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

      {/* ── SECURITY / CHANGE PASSWORD ── only if password auth is enabled */}
      {hasPassword && (
        <SectionCard icon={<Shield className="h-4 w-4 text-primary" />} title={s.security}>
          <div className="space-y-3">
            <PasswordField
              id="current-pw"
              label={s.currentPassword}
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggle={() => setShowCurrent(v => !v)}
            />
            <PasswordField
              id="new-pw"
              label={s.newPassword}
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew(v => !v)}
            />
            <PasswordField
              id="confirm-pw"
              label={s.confirmNewPassword}
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggle={() => setShowConfirm(v => !v)}
            />

            {pwError && (
              <p className="text-sm text-red-400 font-medium">{pwError}</p>
            )}

            <Button
              onClick={handleChangePassword}
              disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11 mt-1"
            >
              {pwSaving ? t.common.saving : s.changePasswordSave}
            </Button>
          </div>
        </SectionCard>
      )}

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

/* ── helpers ── */

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

function PasswordField({ id, label, value, onChange, show, onToggle }: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-sm">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-muted border-border text-foreground rounded-xl pe-10"
          dir="ltr"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground/60 hover:text-foreground/70 transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
