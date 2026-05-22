import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

type Step = "email" | "otp";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("otp");
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

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[s.inner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={s.logoRow}>
          <View style={[s.logoBox, { backgroundColor: colors.primary }]}>
            <Text style={s.logoLetter}>C</Text>
          </View>
          <Text style={[s.wordmark, { color: colors.foreground }]}>CLASIKO</Text>
        </View>

        <Text style={[s.headline, { color: colors.foreground }]}>
          {step === "email" ? "Sign in to your team" : "Enter your code"}
        </Text>
        <Text style={[s.sub, { color: colors.mutedForeground }]}>
          {step === "email"
            ? "We'll send a magic link to your email"
            : `Code sent to ${email}`}
        </Text>

        {step === "email" ? (
          <TextInput
            style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="go"
            onSubmitEditing={sendOtp}
          />
        ) : (
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
        )}

        <TouchableOpacity
          style={[s.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
          onPress={step === "email" ? sendOtp : verifyOtp}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>{step === "email" ? "Send code" : "Sign in"}</Text>
          )}
        </TouchableOpacity>

        {step === "otp" && (
          <TouchableOpacity
            style={s.back}
            onPress={() => { setStep("email"); setOtp(""); }}
          >
            <Feather name="arrow-left" size={16} color={colors.mutedForeground} />
            <Text style={[s.backText, { color: colors.mutedForeground }]}>Use a different email</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    inner: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
    logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 48 },
    logoBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    logoLetter: { color: "#fff", fontSize: 26, fontWeight: "900" },
    wordmark: { fontSize: 28, fontWeight: "800", letterSpacing: 4 },
    headline: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
    sub: { fontSize: 15, lineHeight: 22, marginBottom: 32 },
    input: {
      height: 52,
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      borderWidth: 1,
      marginBottom: 16,
    },
    btn: {
      height: 52,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    back: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", padding: 12 },
    backText: { fontSize: 14 },
  });
