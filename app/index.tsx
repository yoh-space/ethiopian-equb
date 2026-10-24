import { Redirect, type Href } from "expo-router";
import { useAuth } from "@clerk/expo";
import { StartupScreen } from "@/components/layout/StartupScreen";
import { useTranslation } from "@/core/i18n";
import { useSettingsHydration } from "@/hooks/useSettingsHydration";
import { useEqubStore } from "@/store";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const settingsHydrated = useSettingsHydration();
  const { t } = useTranslation();
  const accessChecked = useEqubStore((state) => state.accessChecked);
  const role = useEqubStore((state) => state.role);
  if (!isLoaded || !settingsHydrated) return <StartupScreen />;
  if (isSignedIn && !accessChecked) {
    return <StartupScreen message={t.connectingToEqub} detail={t.startupHelp} />;
  }
  const destination: Href = isSignedIn ? role ? "/(tabs)" : "/access" as Href : "/sign-in" as Href;
  return <Redirect href={destination} />;
}
