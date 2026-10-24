import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "@/core/i18n";
import { useTheme } from "@/theme";

interface StartupScreenProps {
  message?: string;
  detail?: string;
}

export function StartupScreen({ message, detail }: StartupScreenProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text accessibilityRole="text" style={[styles.message, { color: colors.text }]}>
        {message ?? t.loading}
      </Text>
      {detail ? <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  message: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  detail: { maxWidth: 340, fontSize: 13, lineHeight: 19, textAlign: "center" },
});
