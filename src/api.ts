import { LocalStorage, getPreferenceValues } from "@raycast/api";
import { QueueVideo, parseBoardVideos } from "./board";

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

export interface PollStatus {
  running: boolean;
  started_at: number | null;
  summary_id: number | null;
  summary: { channels: number; new_videos: number; errors: string[] } | null;
}

async function apiRequestText(path: string, init?: RequestInit): Promise<string> {
  const { baseUrl, apiToken } = getConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401) {
    throw new Error("Unauthorized — check your API token in extension preferences.");
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

/**
 * There's no JSON API for the queue, so this reads the same /board HTML
 * the web UI renders and parses it (see ./board). That keeps the extension
 * in lockstep with the server's own filtering (hidden channels, shorts,
 * title include/exclude) instead of a shadow reimplementation that can
 * drift out of sync whenever the board changes.
 */
export async function fetchBoardVideos(): Promise<QueueVideo[]> {
  const html = await apiRequestText("/board");
  return parseBoardVideos(html);
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

const LAST_REFRESHED_KEY = "wytchr.lastRefreshedAt";

/**
 * wytchr doesn't expose when it last polled, so the extension tracks its
 * own last-triggered time in Raycast's LocalStorage and uses that to decide
 * whether a refresh is due.
 */
async function getLastRefreshedAt(): Promise<number | null> {
  const raw = await LocalStorage.getItem<string>(LAST_REFRESHED_KEY);
  return raw ? Number(raw) : null;
}

/**
 * Load the current queue, triggering a poll first if it's been more than
 * `refreshIntervalMinutes` since this extension last triggered one (or
 * always, when `force` is set). Waits (bounded) for /poll/status to report
 * done before reading the board.
 */
export async function loadQueue(
  refreshIntervalMinutes: number,
  onStatus?: (status: "polling" | "done") => void,
  force = false,
): Promise<QueueVideo[]> {
  const lastRefreshedAt = await getLastRefreshedAt();
  const staleMs = refreshIntervalMinutes * 60 * 1000;
  const isStale = lastRefreshedAt == null || Date.now() - lastRefreshedAt > staleMs;

  if (force || isStale) {
    onStatus?.("polling");
    await triggerPoll();

    const maxAttempts = 30; // ~60s at 2s intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await sleep(2000);
      const status = await getPollStatus();
      if (!status.running) break;
    }
    await LocalStorage.setItem(LAST_REFRESHED_KEY, String(Date.now()));
    onStatus?.("done");
  }

  return fetchBoardVideos();
}
