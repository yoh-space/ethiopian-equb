import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SystemBars } from "react-native-edge-to-edge";
import { AppButton, AppTextInput, Card, Notice } from "@/components/ui";
import { money } from "@/core/engine";
import { useTranslation } from "@/core/i18n";
import { showToast } from "@/core/feedback";
import { selectActiveCycle, useEqubStore } from "@/store";
import { radius, spacing, useTheme } from "@/theme";

/** Modal route: /record-payment */
export function RecordPaymentScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const data = useEqubStore((s) => s.data);
  const role = useEqubStore((s) => s.role);
  const memberId = useEqubStore((s) => s.memberId);
  const recordPayment = useEqubStore((s) => s.recordPayment);

  const activeCycle = selectActiveCycle(data);
  const cycleId = activeCycle?.id ?? "";
  const participants = data.members.filter((member) =>
    member.status === "active" && (!activeCycle?.participantMemberIds || activeCycle.participantMemberIds.includes(member.id))
  );
  const [selectedMember, setSelectedMember] = useState("");
  const [amount, setAmount] = useState(String(data.contributionAmount));
  const [note, setNote] = useState("");

  const submit = async () => {
    const targetMemberId = role === "admin" ? selectedMember : memberId ?? "";
    if (!cycleId || !targetMemberId) {
      showToast("error", "Choose a member", t.selectMember);
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      showToast("error", "Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    try {
      await recordPayment({ memberId: targetMemberId, cycleId, amount: value, note });
    } catch (error) {
      showToast("error", "Could not complete action", error instanceof Error ? error.message : "Unknown error");
      return;
    }
    showToast("success", "Submitted", t.paymentSaved);
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <SystemBars style={isDark ? "light" : "dark"} />
      <View style={[styles.introIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="card-outline" size={27} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t.recordPayment}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{t.paymentFormIntro}</Text>
      {activeCycle ? (
        <Card style={styles.cycleCard}>
          <View style={[styles.cycleIcon, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.cycleInfo}>
            <Text style={[styles.cycleLabel, { color: colors.muted }]}>{t.activeCycle}</Text>
            <Text style={[styles.cycleTitle, { color: colors.text }]}>{activeCycle.label}</Text>
          </View>
          <Text style={[styles.cycleAmount, { color: colors.primary }]}>{money(activeCycle.contributionAmount)}</Text>
        </Card>
      ) : <Notice>{t.noActiveCycle}</Notice>}
      {role === "admin" ? (
        <>
          <View style={styles.sectionHeading}>
            <Text style={[styles.label, { color: colors.text }]}>{t.selectMember}</Text>
            <Text style={[styles.count, { color: colors.muted }]}>{participants.length}</Text>
          </View>
          {participants.length === 0 ? <Notice>{t.noActiveMembers}</Notice> : null}
          <View style={styles.memberList}>
            {participants.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setSelectedMember(m.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedMember === m.id }}
              style={[
                styles.option,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedMember === m.id && { backgroundColor: colors.noticeBackground, borderColor: colors.primary },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.avatarLetter, { color: colors.primary }]}>{m.name.slice(0, 1)}</Text>
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>{m.name}</Text>
                <Text style={[styles.optionMeta, { color: colors.muted }]}>
                  {t.customerNumber}: {m.customerNumber ?? t.noIdentity}
                </Text>
              </View>
              <Ionicons
                name={selectedMember === m.id ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={selectedMember === m.id ? colors.primary : colors.border}
              />
            </Pressable>
          ))}
          </View>
        </>
      ) : (
        <Notice>{t.paymentForYou}</Notice>
      )}
      <Card style={styles.amountCard}>
        <Text style={[styles.label, { color: colors.text }]}>{t.contribution}</Text>
        <AppTextInput value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <Text style={[styles.label, { color: colors.text, marginTop: 12 }]}>{t.paymentNote}</Text>
        <AppTextInput value={note} onChangeText={setNote} placeholder={t.paymentNote} />
      </Card>
      <View style={styles.actions}>
        <AppButton label={t.cancel} onPress={() => router.back()} secondary />
        <AppButton label={t.submitPayment} onPress={submit} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  introIcon: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 25, fontWeight: "800" },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: -7 },
  cycleCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  cycleIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cycleInfo: { flex: 1 },
  cycleLabel: { fontSize: 10, fontWeight: "700" },
  cycleTitle: { fontSize: 14, fontWeight: "800", marginTop: 3 },
  cycleAmount: { fontSize: 13, fontWeight: "800" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  label: { fontSize: 13, fontWeight: "700" },
  count: { fontSize: 12, fontWeight: "700" },
  memberList: { gap: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: radius.md, borderWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 16, fontWeight: "800" },
  optionInfo: { flex: 1 },
  optionTitle: { fontWeight: "700", fontSize: 13 },
  optionMeta: { fontSize: 10, marginTop: 4 },
  amountCard: { gap: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
