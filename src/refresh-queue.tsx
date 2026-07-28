import { Toast, showHUD, showToast } from "@raycast/api";
import { getRefreshIntervalMinutes, loadQueue } from "./api";

export default async function RefreshQueue() {
  await showToast({ style: Toast.Style.Animated, title: "Refreshing queue…" });
  try {
    // Report what's actually in the queue (matches the homepage), not the
    // poll's new-videos-this-run delta — the scheduler usually already
    // picked most things up, so that delta is often 0 even when the queue
    // has plenty of unwatched videos.
    const videos = await loadQueue(getRefreshIntervalMinutes(), undefined, true);
    await showHUD(`✓ Refreshed — ${videos.length} video${videos.length === 1 ? "" : "s"} in queue`);
  } catch (error) {
    await showHUD(`✗ Failed to refresh — ${error instanceof Error ? error.message : String(error)}`);
  }
}
