import { Action, ActionPanel, Icon, List, Toast, showToast, open } from "@raycast/api";
import { useEffect, useState } from "react";
import { getRefreshIntervalMinutes, hideVideo, loadQueue, markVideoWatched } from "./api";
import { QueueVideo } from "./board";

export default function ReviewQueue() {
  const [videos, setVideos] = useState<QueueVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load(force = false) {
    setIsLoading(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Loading queue…" });
    try {
      const result = await loadQueue(
        getRefreshIntervalMinutes(),
        (status) => {
          if (status === "polling") toast.title = "Refreshing from YouTube…";
        },
        force,
      );
      setVideos(result);
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
    <List isLoading={isLoading} navigationTitle="Queue">
      {videos.map((video) => (
        <List.Item
          key={video.id}
          title={video.title}
          subtitle={video.channelDisplayName}
          icon={video.thumbnailUrl ? { source: video.thumbnailUrl } : Icon.Video}
          accessories={[
            ...(video.profile ? [{ tag: video.profile }] : []),
            { text: video.duration ?? undefined },
            { date: video.uploadDate ?? undefined },
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
