import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { api } from "../../../../convex/_generated/api";
import { AppButton, AppTextInput, Card } from "@/components/ui";
import { showToast } from "@/core/feedback";
import { useTranslation } from "@/core/i18n";
import { useEqubStore } from "@/store";
import { spacing, useTheme } from "@/theme";

export function AccessScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const accessChecked = useEqubStore((state) => state.accessChecked);
  const role = useEqubStore((state) => state.role);
  const createEqub = useMutation(api.equb.ensureEqub);
  const joinEqub = useMutation(api.equb.joinEqub);
  const [joinCode, setJoinCode] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (accessChecked && role) router.replace("/(tabs)");
  }, [accessChecked, role]);

  if (accessChecked && role) return null;

  const createGroup = async () => {
    setBusy(true);
    try {
      await createEqub({});
      router.replace("/(tabs)");
    } catch (error) {
      showToast("error", t.actionFailed, error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const joinGroup = async () => {
    if (!joinCode.trim() || !customerNumber.trim()) {
      showToast("error", t.required, t.joinDetailsRequired);
      return;
    }
    setBusy(true);
    try {
      await joinEqub({
        joinCode: joinCode.trim(),
        customerNumber: customerNumber.trim(),
      });
      showToast("success", t.joinedGroup);
      router.replace("/(tabs)");
    } catch (error) {
      showToast("error", t.actionFailed, error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.safe, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SystemBars style={isDark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <Text style={[styles.brand, { color: colors.primary }]}>EQUB</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t.connectEqub}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{t.connectEqubIntro}</Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.cardHeading}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t.joinGroup}</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>{t.joinGroupIntro}</Text>
          </View>
          <AppTextInput
            value={joinCode}
            onChangeText={(value) => setJoinCode(value.toUpperCase())}
            placeholder={t.groupCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <AppTextInput
            value={customerNumber}
            onChangeText={setCustomerNumber}
            placeholder={t.customerNumber}
            autoCapitalize="none"
          />
          <AppButton label={busy ? t.pleaseWait : t.joinGroup} onPress={joinGroup} disabled={busy} icon="enter-outline" />
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHeading}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t.createGroup}</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>{t.createGroupIntro}</Text>
          </View>
          <AppButton
            label={busy ? t.pleaseWait : t.createGroup}
            onPress={createGroup}
            disabled={busy}
            secondary
            icon="add-circle-outline"
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  heading: { alignItems: "center", gap: 8, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  brand: { fontSize: 13, fontWeight: "900", letterSpacing: 4 },
  title: { fontSize: 25, fontWeight: "900", textAlign: "center" },
  subtitle: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  card: { gap: spacing.md },
  cardHeading: { gap: 5 },
  cardTitle: { fontSize: 16, fontWeight: "800" },
});
