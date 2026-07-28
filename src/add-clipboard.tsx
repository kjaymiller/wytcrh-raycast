import { Clipboard, LaunchProps, Toast, showHUD, showToast } from "@raycast/api";
import { getPreferenceValues } from "@raycast/api";
import { addChannel, looksLikeUrl, Preferences } from "./api";

export default async function AddClipboard(props: LaunchProps<{ arguments: Arguments.AddClipboard }>) {
  const prefs = getPreferenceValues<Preferences>();
  const profile = props.arguments.profile?.trim() || prefs.defaultProfile?.trim() || undefined;

  const clip = (await Clipboard.readText())?.trim();
  if (!clip || !looksLikeUrl(clip)) {
    await showHUD("✗ No http(s) URL on the clipboard");
    return;
  }

  // Animated toast while the request is in flight; final result is a HUD so it
  // stays visible after Raycast closes the window for this no-view command.
  await showToast({ style: Toast.Style.Animated, title: "Adding channel…" });
  try {
    const result = await addChannel({ url: clip, profile });
    await showHUD(`✓ Added channel — ${result.name || clip}`);
  } catch (error) {
    await showHUD(`✗ Failed to add channel — ${error instanceof Error ? error.message : String(error)}`);
  }
}
