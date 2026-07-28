import { Action, ActionPanel, Icon, List, Toast, showToast, open } from "@raycast/api";
import { useEffect, useState } from "react";
import { QueueVideo, getQueueFresh, getRefreshIntervalMinutes, hideVideo, markVideoWatched } from "./api";

function formatDuration(seconds: number | null): string | undefined {
  if (seconds == null) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatUploadDate(ymd: string | null): Date | undefined {
  if (!ymd || ymd.length !== 8) return undefined;
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6)) - 1;
  const day = Number(ymd.slice(6, 8));
  return new Date(year, month, day);
}

function formatLastPolled(epochSeconds: number | null): string {
  if (epochSeconds == null) return "never polled";
  const minutesAgo = Math.round((Date.now() - epochSeconds * 1000) / 60000);
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  return `${Math.round(minutesAgo / 60)}h ago`;
}

export default function ReviewQueue() {
  const [videos, setVideos] = useState<QueueVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);

  async function load(force = false) {
    setIsLoading(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Loading queue…" });
    try {
      const result = await getQueueFresh(
        getRefreshIntervalMinutes(),
        (status) => {
          if (status === "polling") toast.title = "Refreshing from YouTube…";
        },
        force,
      );
      setVideos(result.videos);
      setLastPolledAt(result.last_polled_at);
      toast.hide();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to load queue";
      toast.message = error instanceof Error ? error.message : String(error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleWatched(video: QueueVideo) {
    setVideos((prev) => prev.filter((v) => v.id !== video.id));
    try {
      await markVideoWatched(video.id);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to mark watched",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleHide(video: QueueVideo) {
    setVideos((prev) => prev.filter((v) => v.id !== video.id));
    try {
      await hideVideo(video.id);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to hide video",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <List isLoading={isLoading} navigationTitle={`Queue — last polled ${formatLastPolled(lastPolledAt)}`}>
      {videos.map((video) => (
        <List.Item
          key={video.id}
          title={video.title}
          subtitle={video.channel_display_name}
          icon={video.thumbnail_url ? { source: video.thumbnail_url } : Icon.Video}
          accessories={[
            ...(video.profile ? [{ tag: video.profile }] : []),
            { text: formatDuration(video.duration) },
            { date: formatUploadDate(video.upload_date) },
          ]}
          actions={
            <ActionPanel>
              <Action title="Open Video" icon={Icon.Play} onAction={() => open(video.url)} />
              <Action
                title="Mark as Watched"
                icon={Icon.Checkmark}
                onAction={() => handleWatched(video)}
                shortcut={{ modifiers: ["cmd"], key: "return" }}
              />
              <Action
                title="Hide Video"
                icon={Icon.EyeDisabled}
                onAction={() => handleHide(video)}
                shortcut={{ modifiers: ["cmd"], key: "h" }}
              />
              <Action.CopyToClipboard title="Copy Video URL" content={video.url} />
              <Action
                title="Refresh Queue"
                icon={Icon.ArrowClockwise}
                onAction={() => load(true)}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
              />
            </ActionPanel>
          }
        />
      ))}
      {!isLoading && videos.length === 0 && (
        <List.EmptyView icon={Icon.Video} title="Queue is empty" description="No new videos waiting for review." />
      )}
    </List>
  );
}
