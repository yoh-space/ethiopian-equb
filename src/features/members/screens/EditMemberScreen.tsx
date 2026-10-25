import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SystemBars } from "react-native-edge-to-edge";
import { AppButton, AppTextInput, Card } from "@/components/ui";
import { useTranslation } from "@/core/i18n";
import { showToast } from "@/core/feedback";
import { useEqubStore } from "@/store";
import { spacing, useTheme } from "@/theme";

export function EditMemberScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const role = useEqubStore((state) => state.role);
  const member = useEqubStore((state) => state.data.members.find((item) => item.id === memberId));
  const updateMember = useEqubStore((state) => state.updateMember);
  const [name, setName] = useState(member?.name ?? "");
  const [customerNumber, setCustomerNumber] = useState(member?.customerNumber ?? "");
  const [idNumber, setIdNumber] = useState(member?.idNumber ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");

  if (role !== "admin") return <Redirect href="/(tabs)" />;

  const save = async () => {
    if (!member) return;
    if (!name.trim() || !customerNumber.trim() || !idNumber.trim()) {
      showToast("error", "Required", t.required);
      return;
    }
    try {
      await updateMember(member.id, { name, customerNumber, idNumber, phone });
    } catch (error) {
      showToast("error", "Could not update member", error instanceof Error ? error.message : "Unknown error");
      return;
    }
    showToast("success", "Saved", t.memberAdded);
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <SystemBars style={isDark ? "light" : "dark"} />
      <View style={[styles.introIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="person-outline" size={27} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t.editMember}</Text>
      {member ? (
        <>
          <Card style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>{t.name}</Text>
            <AppTextInput value={name} onChangeText={setName} placeholder={t.name} />
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
        </>
      ) : (
        <>
          <Text style={{ color: colors.muted }}>{t.noMembers}</Text>
          <AppButton label={t.cancel} onPress={() => router.back()} secondary />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  introIcon: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 25, fontWeight: "800", marginBottom: 2 },
  form: { gap: 4, padding: spacing.lg },
  label: { fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
