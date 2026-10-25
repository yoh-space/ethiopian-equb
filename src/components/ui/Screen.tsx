import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SystemBars } from "react-native-edge-to-edge";
import { useTheme } from "@/theme";
import { AppHeader } from "../layout/AppHeader";

/** Standard tab-screen scaffold: themed safe area and brand header. */
export function Screen({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <SystemBars style={isDark ? "light" : "dark"} />
      <AppHeader />
      <View style={[styles.main, { backgroundColor: colors.background }]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  main: { flex: 1 },
});
