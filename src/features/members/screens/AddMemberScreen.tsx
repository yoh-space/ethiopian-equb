import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SystemBars } from "react-native-edge-to-edge";
import { AppButton, AppTextInput, Card } from "@/components/ui";
import { useTranslation } from "@/core/i18n";
import { showToast } from "@/core/feedback";
import { useEqubStore } from "@/store";
import { spacing, useTheme } from "@/theme";

/** Modal route: /add-member */
export function AddMemberScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const role = useEqubStore((s) => s.role);
  const addMember = useEqubStore((s) => s.addMember);
  const [name, setName] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");

  if (role !== "admin") return <Redirect href="/(tabs)" />;

  const save = async () => {
    if (!name.trim() || !customerNumber.trim() || !idNumber.trim()) {
      showToast("error", "Required", t.required);
      return;
    }
    try {
      await addMember({ name, customerNumber, idNumber, phone });
    } catch (error) {
      showToast("error", "Could not add member", error instanceof Error ? error.message : "Unknown error");
      return;
    }
    showToast("success", "Success", t.memberAdded);
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <SystemBars style={isDark ? "light" : "dark"} />
      <View style={[styles.introIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="person-add-outline" size={27} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t.addMember}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{t.required}</Text>
      <Card style={styles.form}>
        <Text style={[styles.label, { color: colors.text }]}>{t.name}</Text>
        <AppTextInput value={name} onChangeText={setName} placeholder={t.name} autoFocus />
        <Text style={[styles.label, { color: colors.text }]}>{t.customerNumber}</Text>
        <AppTextInput value={customerNumber} onChangeText={setCustomerNumber} placeholder={t.customerNumber} />
        <Text style={[styles.label, { color: colors.text }]}>{t.idNumber}</Text>
        <AppTextInput value={idNumber} onChangeText={setIdNumber} placeholder={t.idNumber} />
        <Text style={[styles.label, { color: colors.text }]}>{t.phoneOptional}</Text>
        <AppTextInput value={phone} onChangeText={setPhone} placeholder={t.phoneOptional} keyboardType="phone-pad" />
      </Card>
      <View style={styles.actions}>
        <AppButton label={t.cancel} onPress={() => router.back()} secondary />
        <AppButton label={t.save} onPress={save} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  introIcon: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 25, fontWeight: "800", marginTop: 2 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: -8 },
  form: { gap: 4, padding: spacing.lg },
  label: { fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
