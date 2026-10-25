import { useSSO } from "@clerk/expo";
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { AppButton, AppTextInput, Card } from "@/components/ui";
import { showToast } from "@/core/feedback";
import { useTranslation } from "@/core/i18n";
import { spacing, useTheme } from "@/theme";

type Mode = "signIn" | "signUp";
type Step = "email" | "code";

export default function SignInScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { startSSOFlow } = useSSO();
  const signInAuth = useSignIn();
  const signUpAuth = useSignUp();
  const [mode, setMode] = useState<Mode>("signIn");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const showError = (error: unknown) => {
    showToast("error", t.authenticationFailed, error instanceof Error ? error.message : String(error));
  };

  const continueWithEmail = async () => {
    if (!email.trim()) {
      showToast("error", "Email required", "Enter your email address to continue.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signUp") {
        if (!signUpAuth.isLoaded || !signUpAuth.signUp) throw new Error("Sign-up is still loading.");
        await signUpAuth.signUp.create({ emailAddress: email.trim() });
        await signUpAuth.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      } else {
        if (!signInAuth.isLoaded || !signInAuth.signIn) throw new Error("Sign-in is still loading.");
        await signInAuth.signIn.create({ identifier: email.trim() });
        const emailCode = signInAuth.signIn.supportedFirstFactors?.find(
          (factor) => factor.strategy === "email_code" && "emailAddressId" in factor,
        );
        if (!emailCode || !("emailAddressId" in emailCode)) {
          throw new Error("Email verification codes are not enabled for this Clerk application.");
        }
        await signInAuth.signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailCode.emailAddressId,
        });
      }
      setStep("code");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      showToast("error", "Code required", "Enter the verification code sent to your email.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signUp") {
        if (!signUpAuth.isLoaded || !signUpAuth.signUp || !signUpAuth.setActive) {
          throw new Error("Sign-up is still loading.");
        }
        const result = await signUpAuth.signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (result.status !== "complete" || !result.createdSessionId) {
          throw new Error("Clerk needs more information to finish this sign-up. Complete any remaining setup in the Clerk Dashboard.");
        }
        await signUpAuth.setActive({ session: result.createdSessionId });
      } else {
        if (!signInAuth.isLoaded || !signInAuth.signIn || !signInAuth.setActive) {
          throw new Error("Sign-in is still loading.");
        }
        const result = await signInAuth.signIn.attemptFirstFactor({ strategy: "email_code", code: code.trim() });
        if (result.status !== "complete" || !result.createdSessionId) {
          throw new Error("Clerk needs more information to finish this sign-in. Complete any remaining setup in the Clerk Dashboard.");
        }
        await signInAuth.setActive({ session: result.createdSessionId });
      }
      router.replace("/(tabs)");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setBusy(true);
    try {
      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: "equb://oauth-callback",
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      } else if (signUp?.status === "missing_requirements") {
        throw new Error("Complete the remaining required account fields in the Clerk Dashboard.");
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.safe, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SystemBars style={isDark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={[styles.brandTitle, { color: colors.brand }]}>EQUB</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Sign in to securely manage your Equb.</Text>
        </View>
        <Card style={styles.card}>
          {step === "email" ? (
            <>
              <AppButton label="Continue with Google" icon="logo-google" onPress={continueWithGoogle} disabled={busy} />
              <Text style={[styles.separator, { color: colors.muted }]}>or continue with email</Text>
              <AppTextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <AppButton
                label={busy ? "Please wait…" : mode === "signIn" ? "Continue with email" : "Create account"}
                onPress={continueWithEmail}
                disabled={busy}
              />
              <AppButton
                label={mode === "signIn" ? "Create a new account" : "I already have an account"}
                onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
                secondary
                disabled={busy}
              />
            </>
          ) : (
            <>
              <Text style={[styles.codeHeading, { color: colors.text }]}>Check your email</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>Enter the verification code sent to {email}.</Text>
              <AppTextInput value={code} onChangeText={setCode} placeholder="Verification code" keyboardType="number-pad" />
              <AppButton label={busy ? "Verifying…" : "Verify email"} onPress={verifyCode} disabled={busy} />
              <AppButton label="Back" onPress={() => setStep("email")} secondary disabled={busy} />
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.xl },
  brand: { alignItems: "center", gap: spacing.sm },
  brandTitle: { fontSize: 32, fontWeight: "900", letterSpacing: 5 },
  subtitle: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  card: { gap: spacing.md },
  separator: { fontSize: 12, textAlign: "center" },
  codeHeading: { fontSize: 20, fontWeight: "800", textAlign: "center" },
});
