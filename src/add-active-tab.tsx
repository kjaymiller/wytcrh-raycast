import { LaunchProps, Toast, showHUD, showToast } from "@raycast/api";
import { getPreferenceValues } from "@raycast/api";
import { addChannel, Preferences } from "./api";
import { getActiveTab } from "./browser";

export default async function AddActiveTab(props: LaunchProps<{ arguments: Arguments.AddActiveTab }>) {
  const prefs = getPreferenceValues<Preferences>();
  const profile = props.arguments.profile?.trim() || prefs.defaultProfile?.trim() || undefined;

  const tab = await getActiveTab();
  if (!tab) {
    await showHUD("✗ No active browser tab to add");
    return;
  }

  // Animated toast while the request is in flight; final result is a HUD so it
  // stays visible after Raycast closes the window for this no-view command.
  await showToast({ style: Toast.Style.Animated, title: "Adding channel…" });
  try {
    const result = await addChannel({ url: tab.url, profile });
    await showHUD(`✓ Added channel — ${result.name || tab.url}`);
  } catch (error) {
    await showHUD(`✗ Failed to add channel — ${error instanceof Error ? error.message : String(error)}`);
  }
}
