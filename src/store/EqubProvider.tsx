import AsyncStorage from "@react-native-async-storage/async-storage";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { create } from "zustand";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { migratePersistedEqubState } from "@/core/engine";
import type { EqubState } from "@/core/engine";

export const EQUB_STORAGE_KEY = "ethiopian-equb-state-v1";

interface EqubStore {
  data: EqubState;
  ready: boolean;
  accessChecked: boolean;
  role: "admin" | "member" | null;
  memberId: string | null;
  joinCode: string | null;
  memberRoles: { memberId: string; role: "admin" | "member" }[];
  addMember: (input: { name: string; customerNumber: string; idNumber: string; phone?: string }) => Promise<void>;
  updateMember: (memberId: string, input: { name: string; customerNumber: string; idNumber: string; phone?: string }) => Promise<void>;
  recordPayment: (input: { memberId: string; cycleId: string; amount: number; note?: string }) => Promise<void>;
  verifyPayment: (contributionId: string, confirmed: boolean) => Promise<void>;
  approvePayoutById: (payoutId: string) => Promise<void>;
  drawWinner: () => Promise<void>;
  advanceCycle: () => Promise<void>;
  startNextRotation: () => Promise<void>;
  setMemberRole: (memberId: string, role: "admin" | "member") => Promise<void>;
  rotateJoinCode: () => Promise<void>;
}

const notReady = async () => {
  throw new Error("Equb data is not ready.");
};

const emptyEqubState: EqubState = {
  groupName: "",
  currency: "ETB",
  contributionAmount: 0,
  frequency: "monthly",
  members: [],
  contributions: [],
  cycles: [],
  payouts: [],
  draws: [],
  currentRotation: 0,
};

export const useEqubStore = create<EqubStore>(() => ({
  data: emptyEqubState,
  ready: false,
  accessChecked: false,
  role: null,
  memberId: null,
  joinCode: null,
  memberRoles: [],
  addMember: notReady,
  updateMember: notReady,
  recordPayment: notReady,
  verifyPayment: notReady,
  approvePayoutById: notReady,
  drawWinner: notReady,
  advanceCycle: notReady,
  startNextRotation: notReady,
  setMemberRole: notReady,
  rotateJoinCode: notReady,
}));

function withoutDemoSeed(state: EqubState): EqubState {
  const demoIds = new Set(state.members.filter((member) => /^member-\d+$/.test(member.id)).map((member) => member.id));
  const members = state.members.filter((member) => !demoIds.has(member.id));
  const contributions = state.contributions.filter((payment) =>
    !payment.id.startsWith("demo-payment-") && !demoIds.has(payment.memberId)
  );
  const validMemberIds = new Set(members.map((member) => member.id));
  const cycles = state.cycles.map((cycle) => {
    const { recipientMemberId, ...cycleWithoutRecipient } = cycle;
    return {
      ...cycleWithoutRecipient,
      participantMemberIds: (cycle.participantMemberIds ?? members.filter((member) => member.status === "active").map((member) => member.id))
        .filter((memberId) => validMemberIds.has(memberId)),
      ...(recipientMemberId && validMemberIds.has(recipientMemberId) ? { recipientMemberId } : {}),
    };
  });
  return {
    ...state,
    groupName: state.groupName === "የእኩብ ቡድን" ? "My Equb" : state.groupName,
    members,
    contributions,
    cycles,
    payouts: state.payouts.filter((payout) => validMemberIds.has(payout.recipientMemberId)),
    draws: (state.draws ?? []).filter((draw) => validMemberIds.has(draw.winnerMemberId)),
  };
}

export function EqubProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const result = useQuery(api.equb.getState, isAuthenticated ? {} : "skip");
  const importDeviceState = useMutation(api.equb.importDeviceState);
  const addMember = useMutation(api.equb.addMember);
  const updateMember = useMutation(api.equb.updateMember);
  const recordPayment = useMutation(api.equb.recordPayment);
  const verifyPayment = useMutation(api.equb.verifyPayment);
  const approvePayoutById = useMutation(api.equb.approvePayoutById);
  const drawWinner = useMutation(api.equb.drawWinnerForCycle);
  const advanceCycle = useMutation(api.equb.advanceCycleForEqub);
  const startNextRotation = useMutation(api.equb.startNextRotationForEqub);
  const setMemberRole = useMutation(api.equb.setMemberRole);
  const rotateJoinCode = useMutation(api.equb.rotateJoinCode);
  const [migrationReady, setMigrationReady] = useState(false);
  const migrationInProgress = useRef(false);
  const storeReady = useEqubStore((state) => state.ready);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  useEffect(() => {
    if (result === undefined || migrationReady || migrationError || migrationInProgress.current) return;
    if (result === null) return;
    migrationInProgress.current = true;
    void (async () => {
      try {
        const raw = result.role === "admin" ? await AsyncStorage.getItem(EQUB_STORAGE_KEY) : null;
        if (raw && result.role === "admin") {
          const parsed: unknown = JSON.parse(raw);
          const envelope = parsed && typeof parsed === "object" && "state" in parsed
            ? (parsed as { state?: { data?: unknown } }).state?.data
            : parsed;
          const migrated = migratePersistedEqubState(envelope);
          if (!migrated) throw new Error("The saved data format is invalid. Local data was preserved.");
          const cleaned = withoutDemoSeed(migrated);
          if (cleaned.members.length || cleaned.contributions.length || cleaned.draws?.length) {
            if (!result.importedFromDevice) await importDeviceState({ state: cleaned });
          }
          await AsyncStorage.removeItem(EQUB_STORAGE_KEY);
        }
        setMigrationReady(true);
      } catch (error) {
        setMigrationError(error instanceof Error ? error.message : String(error));
      } finally {
        migrationInProgress.current = false;
      }
    })();
  }, [importDeviceState, migrationError, migrationReady, result]);

  useEffect(() => {
    if (result === undefined || result === null || !migrationReady) return;
    useEqubStore.setState({
      data: result.state,
      ready: true,
      accessChecked: true,
      role: result.role,
      memberId: result.memberId,
      joinCode: result.joinCode,
      memberRoles: result.memberRoles,
      addMember: async (input) => { await addMember(input); },
      updateMember: async (memberId, input) => { await updateMember({ memberId, ...input }); },
      recordPayment: async (input) => { await recordPayment(input); },
      verifyPayment: async (contributionId, confirmed) => { await verifyPayment({ contributionId, confirmed }); },
      approvePayoutById: async (payoutId) => { await approvePayoutById({ payoutId }); },
      drawWinner: async () => { await drawWinner({}); },
      advanceCycle: async () => { await advanceCycle({}); },
      startNextRotation: async () => { await startNextRotation({}); },
      setMemberRole: async (memberId, role) => { await setMemberRole({ memberId, role }); },
      rotateJoinCode: async () => { await rotateJoinCode({}); },
    });
  }, [
    addMember,
    advanceCycle,
    approvePayoutById,
    drawWinner,
    migrationReady,
    recordPayment,
    result,
    startNextRotation,
    setMemberRole,
    rotateJoinCode,
    updateMember,
    verifyPayment,
  ]);

  useLayoutEffect(() => {
    if (result === undefined || result === null) {
      useEqubStore.setState({
        data: emptyEqubState,
        ready: false,
        accessChecked: result !== undefined,
        role: null,
        memberId: null,
        joinCode: null,
        memberRoles: [],
      });
    }
  }, [result]);

  useEffect(() => () => {
    useEqubStore.setState({
      data: emptyEqubState,
      ready: false,
      accessChecked: false,
      role: null,
      memberId: null,
      joinCode: null,
      memberRoles: [],
      addMember: notReady,
      updateMember: notReady,
      recordPayment: notReady,
      verifyPayment: notReady,
      approvePayoutById: notReady,
      drawWinner: notReady,
      advanceCycle: notReady,
      startNextRotation: notReady,
      setMemberRole: notReady,
      rotateJoinCode: notReady,
    });
  }, []);

  if (migrationError) {
    return (
      <View style={styles.status}>
        <Text style={styles.errorTitle}>Could not import this device&apos;s Equb data</Text>
        <Text style={styles.errorMessage}>{migrationError}</Text>
        <Text accessibilityRole="button" onPress={() => setMigrationError(null)} style={styles.retry}>Retry</Text>
      </View>
    );
  }
  if (result === undefined) {
    return (
      <View style={styles.status}>
        <ActivityIndicator />
        <Text style={styles.errorMessage}>Loading your Equb data…</Text>
      </View>
    );
  }
  if (result === null) return <>{children}</>;
  if (!migrationReady || !storeReady) {
    return (
      <View style={styles.status}>
        <ActivityIndicator />
        <Text style={styles.errorMessage}>Loading your Equb data…</Text>
      </View>
    );
  }
  return <>{children}</>;
}

export type { EqubStore };

const styles = StyleSheet.create({
  status: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, backgroundColor: "#fff" },
  errorTitle: { color: "#111827", fontSize: 18, fontWeight: "800", textAlign: "center" },
  errorMessage: { color: "#4b5563", fontSize: 14, lineHeight: 21, textAlign: "center" },
  retry: { color: "#1d4ed8", fontWeight: "700", padding: 10 },
});
