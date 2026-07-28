import { getPreferenceValues } from "@raycast/api";

export interface Preferences {
  baseUrl: string;
  apiToken: string;
  defaultProfile?: string;
  refreshIntervalMinutes?: string;
}

export interface AddChannelInput {
  url: string;
  name?: string;
  profile?: string;
  addToFavs?: boolean;
}

export interface AddChannelResult {
  name?: string;
}

function getConfig(): { baseUrl: string; apiToken: string } {
  const prefs = getPreferenceValues<Preferences>();
  const baseUrl = prefs.baseUrl.trim().replace(/\/+$/, "");
  return { baseUrl, apiToken: prefs.apiToken.trim() };
}

/** Minutes of staleness allowed before Review Queue triggers a background poll. */
export function getRefreshIntervalMinutes(): number {
  const prefs = getPreferenceValues<Preferences>();
  const parsed = Number(prefs.refreshIntervalMinutes);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, apiToken } = getConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401) {
    throw new Error("Unauthorized — check your API token in extension preferences.");
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export function looksLikeUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * wytchr's /channels/add is an HTML form endpoint, not JSON: it always
 * responds with a redirect — to "/" on success, back to
 * "/channels/add?error=..." on failure, or "/login" when unauthenticated.
 * We follow manually so we can read which happened.
 */
export async function addChannel(input: AddChannelInput): Promise<AddChannelResult> {
  const { baseUrl, apiToken } = getConfig();

  const body = new URLSearchParams();
  body.set("url", input.url);
  if (input.name) body.set("name", input.name);
  if (input.profile) body.set("profile", input.profile);
  if (input.addToFavs) body.set("add_to_favs", "1");

  const response = await fetch(`${baseUrl}/channels/add`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (response.status === 401) {
    throw new Error("Unauthorized — check your API token in extension preferences.");
  }

  const location = response.headers.get("location");
  if (location) {
    const target = new URL(location, `${baseUrl}/`);
    if (target.pathname === "/login") {
      throw new Error("Unauthorized — check your API token in extension preferences.");
    }
    if (target.pathname === "/channels/add") {
      throw new Error(target.searchParams.get("error") || "Failed to add channel");
    }
    return { name: input.name };
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return { name: input.name };
}

export interface QueueVideo {
  id: string;
  title: string;
  url: string;
  channel: string;
  channel_display_name: string;
  profile: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  upload_date: string | null;
}

export interface QueueResponse {
  videos: QueueVideo[];
  last_polled_at: number | null;
}

export interface PollStatus {
  running: boolean;
  started_at: number | null;
  summary_id: number | null;
  summary: { channels: number; new_videos: number; errors: string[] } | null;
}

export async function getQueue(limit = 50): Promise<QueueResponse> {
  return apiRequest<QueueResponse>(`/api/queue?limit=${limit}`);
}

export async function triggerPoll(): Promise<void> {
  await apiRequest("/poll/all", { method: "POST" });
}

export async function getPollStatus(): Promise<PollStatus> {
  return apiRequest<PollStatus>("/poll/status");
}

export async function markVideoWatched(videoId: string): Promise<void> {
  await apiRequest(`/videos/${encodeURIComponent(videoId)}/watched`, { method: "POST" });
}

export async function hideVideo(videoId: string): Promise<void> {
  await apiRequest(`/videos/${encodeURIComponent(videoId)}/hide`, { method: "POST" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch the queue, refreshing first if wytchr hasn't polled within
 * `refreshIntervalMinutes`. Triggers /poll/all and waits (bounded) for
 * /poll/status to report done before re-reading the queue.
 */
export async function getQueueFresh(
  refreshIntervalMinutes: number,
  onStatus?: (status: "cached" | "polling" | "done") => void,
  force = false,
): Promise<QueueResponse> {
  const initial = await getQueue();
  const staleMs = refreshIntervalMinutes * 60 * 1000;
  const isStale = initial.last_polled_at == null || Date.now() - initial.last_polled_at * 1000 > staleMs;

  if (!force && !isStale) {
    onStatus?.("cached");
    return initial;
  }

  onStatus?.("polling");
  await triggerPoll();

  const maxAttempts = 30; // ~60s at 2s intervals
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(2000);
    const status = await getPollStatus();
    if (!status.running) break;
  }

  onStatus?.("done");
  return getQueue();
}
