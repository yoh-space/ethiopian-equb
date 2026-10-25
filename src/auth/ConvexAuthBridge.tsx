import { useAuth } from "@clerk/expo";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function MissingBackendConfiguration() {
  return (
    <View style={styles.error}>
      <Text style={styles.title}>Backend is not configured</Text>
      <Text style={styles.message}>Set EXPO_PUBLIC_CONVEX_URL in your Expo environment to connect this app to Convex.</Text>
    </View>
  );
}

export function ConvexAuthBridge({ children }: { children: ReactNode }) {
  if (!convexClient) return <MissingBackendConfiguration />;
  return (
    <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fff" },
  title: { color: "#111827", fontSize: 20, fontWeight: "800" },
  message: { color: "#4b5563", fontSize: 14, lineHeight: 21 },
});
