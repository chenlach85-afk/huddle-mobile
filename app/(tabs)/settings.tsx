import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useAppUser, useUpdateAppUser, apiFetch } from "@/lib/useApi";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "he", label: "עברית" },
  { code: "es", label: "Español" },
] as const;

async function uploadAvatarBase64(uri: string): Promise<string | null> {
  try {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const b64: string = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const r = reader.result as string;
        resolve(r.split(",")[1] ?? "");
      };
      reader.readAsDataURL(blob);
    });
    if (!b64) return null;
    const result = await apiFetch<{ url: string }>("/api/files/upload", {
      method: "POST",
      body: JSON.stringify({ filename: "avatar.jpg", mimeType: "image/jpeg", size: b64.length, data: b64 }),
    });
    return result.url ?? null;
  } catch {
    return null;
  }
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: appUser, isLoading, refetch } = useAppUser();
  const { mutate: updateMe, isPending } = useUpdateAppUser();

  const [name, setName] = useState(appUser?.name ?? "");
  const [editing, setEditing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  React.useEffect(() => {
    if (appUser?.name) setName(appUser.name);
  }, [appUser?.name]);

  const saveName = () => {
    if (!name.trim()) return;
    updateMe({ name: name.trim() } as any, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refetch();
        setEditing(false);
      },
    });
  };

  const setLang = (lang: string) => {
    updateMe({ language: lang as "en" | "he" | "es" } as any, {
      onSuccess: () => { Haptics.selectionAsync(); refetch(); },
    });
  };

  const pickAvatar = async (source: "library" | "camera") => {
    const pick =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });

    if (pick.canceled || !pick.assets[0]) return;
    const uri = pick.assets[0].uri;
    setAvatarUploading(true);
    const url = await uploadAvatarBase64(uri);
    setAvatarUploading(false);
    if (!url) {
      Alert.alert("Upload failed", "Could not upload avatar. Please try again.");
      return;
    }
    updateMe({ imageUrl: url } as any, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refetch();
      },
      onError: () => Alert.alert("Error", "Failed to save avatar"),
    });
  };

  const showAvatarOptions = () => {
    Alert.alert("Profile Photo", "Choose a source", [
      { text: "Camera", onPress: () => pickAvatar("camera") },
      { text: "Photo Library", onPress: () => pickAvatar("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  const avatarUrl = (appUser as any)?.imageUrl as string | undefined;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]}>Settings</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PROFILE</Text>
            <View style={styles.profileRow}>
              {/* Avatar with upload button */}
              <TouchableOpacity style={styles.avatarWrap} onPress={showAvatarOptions} activeOpacity={0.8}>
                {avatarUploading ? (
                  <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.avatarText, { fontFamily: "BebasNeue_400Regular" }]}>
                      {(appUser?.name ?? "?")[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                  <Feather name="camera" size={12} color="#fff" />
                </View>
              </TouchableOpacity>

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
                      {isPending ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Feather name="check" size={20} color={colors.primary} />
                      )}
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

            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Email</Text>
              <Text style={[styles.fieldValue, { color: colors.foreground }]}>{appUser?.email ?? "—"}</Text>
            </View>
            <Text style={[styles.emailNote, { color: colors.mutedForeground }]}>
              Email is your sign-in identity and cannot be changed here.
            </Text>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Role</Text>
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
                <TouchableOpacity style={styles.langRow} onPress={() => setLang(lang.code)} activeOpacity={0.7}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>{lang.label}</Text>
                  {appUser?.language === lang.code && <Feather name="check" size={18} color={colors.primary} />}
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
  title: { fontSize: 32, marginBottom: 8 },
  section: { borderRadius: 16, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: { position: "relative" },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { color: "#fff", fontSize: 32 },
  avatarBadge: {
    position: "absolute", bottom: 0, right: 0, width: 22, height: 22,
    borderRadius: 11, alignItems: "center", justifyContent: "center",
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "700" },
  profileEmail: { fontSize: 13, marginTop: 2 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nameInput: { flex: 1, fontSize: 18, fontWeight: "600", borderBottomWidth: 2, paddingBottom: 2 },
  divider: { height: 1, marginVertical: 12 },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldLabel: { fontSize: 14 },
  fieldValue: { fontSize: 14, fontWeight: "500" },
  emailNote: { fontSize: 11, marginTop: 6, fontStyle: "italic" },
  rowLabel: { fontSize: 15 },
  rolePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  rolePillText: { fontSize: 13, fontWeight: "600" },
  langRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 16 },
  signOutText: { fontSize: 16, fontWeight: "700" },
});
