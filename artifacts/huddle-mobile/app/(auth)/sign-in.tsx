import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type Mode = "password" | "otp_request" | "otp_verify";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const signInWithPassword = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    setLoading(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Sign-in failed", error.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const sendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode("otp_verify");
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Invalid code", "Please check the code and try again.");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    try {
      const redirectTo = Linking.createURL("/");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        Alert.alert("Error", error?.message ?? "Could not start sign-in");
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success" && result.url) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (sessionError) {
          Alert.alert("Sign-in failed", sessionError.message);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setOauthLoading(null);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[s.inner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        {/* Logo */}
        <View style={s.logoRow}>
          <View style={[s.logoBox, { backgroundColor: colors.primary }]}>
            <Text style={s.logoLetter}>C</Text>
          </View>
          <Text style={[s.wordmark, { color: colors.foreground }]}>CLASIKO</Text>
        </View>

        {/* OTP verify step */}
        {mode === "otp_verify" ? (
          <>
            <Text style={[s.headline, { color: colors.foreground }]}>Enter your code</Text>
            <Text style={[s.sub, { color: colors.mutedForeground }]}>Code sent to {email}</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              placeholder="6-digit code"
              placeholderTextColor={colors.mutedForeground}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              returnKeyType="go"
              onSubmitEditing={verifyOtp}
              autoFocus
            />
            <TouchableOpacity
              style={[s.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
              onPress={verifyOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign in</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.back} onPress={() => { setMode("otp_request"); setOtp(""); }}>
              <Feather name="arrow-left" size={16} color={colors.mutedForeground} />
              <Text style={[s.backText, { color: colors.mutedForeground }]}>Use a different email</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[s.headline, { color: colors.foreground }]}>Sign in to your team</Text>
            <Text style={[s.sub, { color: colors.mutedForeground }]}>
              {mode === "password" ? "Enter your email and password" : "We'll send a magic code to your email"}
            </Text>

            {/* Email field (shared) */}
            <TextInput
              style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType={mode === "password" ? "next" : "go"}
              onSubmitEditing={mode === "otp_request" ? sendOtp : undefined}
            />

            {/* Password field */}
            {mode === "password" && (
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.passwordInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  placeholder="Password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={signInWithPassword}
                  autoFocus={false}
                />
                <TouchableOpacity
                  style={[s.eyeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  onPress={() => setShowPassword(v => !v)}
                >
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}

            {/* Primary action */}
            <TouchableOpacity
              style={[s.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
              onPress={mode === "password" ? signInWithPassword : sendOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>{mode === "password" ? "Sign in" : "Send code"}</Text>
              )}
            </TouchableOpacity>

            {/* Toggle mode */}
            <TouchableOpacity
              style={s.toggleRow}
              onPress={() => setMode(mode === "password" ? "otp_request" : "password")}
            >
              <Text style={[s.toggleText, { color: colors.mutedForeground }]}>
                {mode === "password" ? "Sign in with a magic code instead" : "Sign in with password instead"}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <Text style={[s.dividerText, { color: colors.mutedForeground }]}>or continue with</Text>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
            </View>

            {/* Google */}
            <TouchableOpacity
              style={[s.oauthBtn, { backgroundColor: colors.muted, borderColor: colors.border }, oauthLoading === "google" && { opacity: 0.7 }]}
              onPress={() => handleOAuthSignIn("google")}
              disabled={oauthLoading !== null}
              activeOpacity={0.85}
            >
              {oauthLoading === "google" ? (
                <ActivityIndicator color={colors.foreground} />
              ) : (
                <>
                  <Text style={{ fontSize: 16 }}>G</Text>
                  <Text style={[s.oauthBtnText, { color: colors.foreground }]}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple (iOS only) */}
            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={[s.oauthBtn, { backgroundColor: "#000", borderColor: "#000" }, oauthLoading === "apple" && { opacity: 0.7 }]}
                onPress={() => handleOAuthSignIn("apple")}
                disabled={oauthLoading !== null}
                activeOpacity={0.85}
              >
                {oauthLoading === "apple" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="smartphone" size={18} color="#fff" />
                    <Text style={[s.oauthBtnText, { color: "#fff" }]}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    inner: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
    logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 40 },
    logoBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    logoLetter: { color: "#fff", fontSize: 26, fontWeight: "900" },
    wordmark: { fontSize: 28, fontWeight: "800", letterSpacing: 4 },
    headline: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
    sub: { fontSize: 15, lineHeight: 22, marginBottom: 28 },
    input: {
      height: 52, borderRadius: 12, paddingHorizontal: 16,
      fontSize: 16, borderWidth: 1, marginBottom: 12,
    },
    passwordRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    passwordInput: {
      flex: 1, height: 52, borderRadius: 12, paddingHorizontal: 16,
      fontSize: 16, borderWidth: 1,
    },
    eyeBtn: {
      width: 52, height: 52, borderRadius: 12, borderWidth: 1,
      alignItems: "center", justifyContent: "center",
    },
    btn: {
      height: 52, borderRadius: 12, alignItems: "center",
      justifyContent: "center", marginBottom: 12,
    },
    btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    toggleRow: { alignItems: "center", marginBottom: 20, padding: 4 },
    toggleText: { fontSize: 14 },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    divider: { flex: 1, height: 1 },
    dividerText: { fontSize: 13 },
    oauthBtn: {
      height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center",
      flexDirection: "row", gap: 10, borderWidth: 1, marginBottom: 12,
    },
    oauthBtnText: { fontSize: 15, fontWeight: "600" },
    back: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", padding: 12 },
    backText: { fontSize: 14 },
  });
