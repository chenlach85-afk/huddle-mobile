import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { useAppUser, useUpdateAppUser } from "@/lib/useApi";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "he", label: "עברית" },
  { code: "es", label: "Español" },
] as const;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: appUser, isLoading, refetch } = useAppUser();
  const { mutate: updateMe, isPending } = useUpdateAppUser();

  const [name, setName] = useState(appUser?.name ?? "");
  const [editing, setEditing] = useState(false);

  React.useEffect(() => {
    if (appUser?.name) setName(appUser.name);
  }, [appUser?.name]);

  const saveName = () => {
    if (!name.trim()) return;
    updateMe({ name: name.trim() }, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refetch();
        setEditing(false);
      },
    });
  };

  const setLang = (lang: string) => {
    updateMe({ language: lang as "en" | "he" | "es" }, {
      onSuccess: () => { Haptics.selectionAsync(); refetch(); },
    });
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PROFILE</Text>
            <View style={styles.profileRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{(appUser?.name ?? "?")[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.profileInfo}>
                {editing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.nameInput, { color: colors.foreground, borderBottomColor: colors.primary }]}
                      value={name}
                      onChangeText={setName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={saveName}
                    />
                    <TouchableOpacity onPress={saveName} disabled={isPending}>
                      {isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="check" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditing(false); setName(appUser?.name ?? ""); }}>
                      <Feather name="x" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[styles.profileName, { color: colors.foreground }]}>{appUser?.name ?? "—"}</Text>
                )}
                <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{appUser?.email ?? "—"}</Text>
              </View>
              {!editing && (
                <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8}>
                  <Feather name="edit-2" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.roleRow}>
              <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Role</Text>
              <View style={[styles.rolePill, { backgroundColor: `${colors.primary}22` }]}>
                <Text style={[styles.rolePillText, { color: colors.primary }]}>{appUser?.role ?? "coach"}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LANGUAGE</Text>
            {LANGUAGES.map((lang, i) => (
              <React.Fragment key={lang.code}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity
                  style={styles.langRow}
                  onPress={() => setLang(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>{lang.label}</Text>
                  {appUser?.language === lang.code && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: `${colors.destructive}18` }]}
            onPress={confirmSignOut}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
          </TouchableOpacity>
        </>
      )}
      <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  section: { borderRadius: 16, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "700" },
  profileEmail: { fontSize: 13, marginTop: 2 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nameInput: { flex: 1, fontSize: 18, fontWeight: "600", borderBottomWidth: 2, paddingBottom: 2 },
  divider: { height: 1, marginVertical: 12 },
  roleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 15 },
  rolePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  rolePillText: { fontSize: 13, fontWeight: "600" },
  langRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 16 },
  signOutText: { fontSize: 16, fontWeight: "700" },
});
