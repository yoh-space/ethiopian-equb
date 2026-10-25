import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import {SystemBars} from "react-native-edge-to-edge";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexAuthBridge } from "@/auth/ConvexAuthBridge";
import { AppFeedback } from "@/components/layout/AppFeedback";
import { StartupScreen } from "@/components/layout/StartupScreen";
import { useTranslation } from "@/core/i18n";
import { EqubProvider } from "@/store";
import { useTheme } from "@/theme";

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AuthenticatedRoutes() {
  const auth = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!auth.isLoaded) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    );
  }
  if (!auth.isSignedIn) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="oauth-callback" />
      </Stack>
    );
  }

  return (
    <EqubProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="access" />
        <Stack.Screen
          name="add-member"
          options={{ presentation: "modal", headerShown: true, title: t.addMember, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}
        />
        <Stack.Screen
          name="edit-member"
          options={{ presentation: "modal", headerShown: true, title: t.editMember, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}
        />
        <Stack.Screen
          name="record-payment"
          options={{ presentation: "modal", headerShown: true, title: t.recordPayment, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}
        />
        <Stack.Screen name="oauth-callback" />
      </Stack>
    </EqubProvider>
  );
}

function AppProviders() {
  return (
    <SafeAreaProvider>
      <SystemBars style={'dark'}/>
      <ConvexAuthBridge>
        <AuthenticatedRoutes />
      </ConvexAuthBridge>
      <AppFeedback />
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  if (!clerkPublishableKey) {
    return (
      <View style={styles.configError}>
        <Text style={styles.configTitle}>Authentication is not configured</Text>
        <Text style={styles.configText}>Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your Expo environment, then rebuild the app.</Text>
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <AppProviders />
    </ClerkProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>{t.somethingWentWrong}</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <Text style={styles.errorHelp}>{t.startupHelp}</Text>
      <Pressable accessibilityRole="button" onPress={() => { void retry(); }} style={styles.retryButton}>
        <Text style={styles.retryText}>{t.tryAgain}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  configError: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fff" },
  configTitle: { color: "#111827", fontSize: 20, fontWeight: "800" },
  configText: { color: "#4b5563", fontSize: 14, lineHeight: 21 },
  error: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fff" },
  errorTitle: { color: "#111827", fontSize: 20, fontWeight: "800" },
  errorMessage: { color: "#b91c1c", fontSize: 14, lineHeight: 21 },
  errorHelp: { color: "#4b5563", fontSize: 14, lineHeight: 21 },
  retryButton: { alignSelf: "flex-start", marginTop: 8, borderRadius: 10, backgroundColor: "#2563eb", paddingHorizontal: 18, paddingVertical: 12 },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
