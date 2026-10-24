import { Redirect, Tabs, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";
import { StartupScreen } from "@/components/layout/StartupScreen";
import { useTranslation } from "@/core/i18n";
import { useTheme } from "@/theme";
import { useEqubStore } from "@/store";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const accessChecked = useEqubStore((state) => state.accessChecked);
  const role = useEqubStore((state) => state.role);

  if (!accessChecked) return <StartupScreen message={t.connectingToEqub} detail={t.startupHelp} />;
  if (!role) return <Redirect href={"/access" as Href} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 },
        tabBarItemStyle: { borderRadius: 16, marginHorizontal: 3, marginVertical: 3 },
        tabBarActiveBackgroundColor: colors.surfaceAlt,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t.dashboard, tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="members"
        options={{ title: t.members, tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="draw"
        options={{ title: t.drawLottery, tabBarIcon: ({ color }) => <Ionicons name="sparkles-outline" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="payments"
        options={{ title: t.finance, tabBarIcon: ({ color }) => <Ionicons name="wallet-outline" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="payouts"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
    </Tabs>
  );
}
