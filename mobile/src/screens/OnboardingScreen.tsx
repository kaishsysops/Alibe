import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Smartphone, Car, Sofa, Shirt, Home } from "lucide-react-native";
import { api } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { colors, spacing, radius } from "../theme/theme";

const HERO_ICONS = [Smartphone, Car, Sofa, Shirt, Home];

export default function OnboardingScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    setLoading(true);
    try {
      await api.requestOtp(phone);
      setStep("otp");
    } catch (e) {
      Alert.alert("Couldn't reach backend", String(e));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    try {
      const { user } = await api.verifyOtp(phone, code);
      await signIn(user);
    } catch (e) {
      Alert.alert("Invalid code", "Use 1234 for this demo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.formWrap}>
        <View style={styles.hero}>
          <Text style={styles.logo}>Alibe</Text>
          <Text style={styles.tagline}>Buy & sell anywhere in the Maldives</Text>
          <View style={styles.iconRow}>
            {HERO_ICONS.map((Icon, i) => (
              <View key={i} style={styles.iconBubble}>
                <Icon size={20} color="#fff" />
              </View>
            ))}
          </View>
        </View>

        {step === "phone" ? (
          <>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+960 7XX XXXX"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity style={styles.button} onPress={requestOtp} disabled={loading || !phone}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter the 4-digit code sent to {phone}</Text>
            <Text style={styles.hint}>(Demo mode: code is always 1234)</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="1234"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity style={styles.button} onPress={verify} disabled={loading || code.length < 4}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: "center" },
  formWrap: { width: "100%", maxWidth: 420, alignSelf: "center" },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  logo: { fontSize: 40, fontWeight: "800", color: "#fff", textAlign: "center" },
  tagline: { fontSize: 15, color: colors.primaryLight, textAlign: "center", marginTop: spacing.xs },
  iconRow: { flexDirection: "row", justifyContent: "center", gap: spacing.md, marginTop: spacing.lg },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
