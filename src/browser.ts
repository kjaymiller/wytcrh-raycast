import { BrowserExtension, environment } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";

export interface ActiveTab {
  url: string;
  title?: string;
}

// Chromium-family browsers share the "active tab of front window" terminology.
const CHROMIUM_BROWSERS = [
  "Arc",
  "Google Chrome",
  "Google Chrome Canary",
  "Brave Browser",
  "Microsoft Edge",
  "Vivaldi",
  "Chromium",
  "Opera",
];

// WebKit browsers expose "front document" instead.
const WEBKIT_BROWSERS = ["Safari", "Safari Technology Preview", "Orion"];

function looksLikeUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Build a single AppleScript that walks known browsers (only those currently
 * running, so we never launch one) and returns "<url>\n<title>" for the first
 * one with an open window. We can't use the frontmost app because Raycast is
 * frontmost while a command runs.
 */
function buildAppleScript(): string {
  const chromium = CHROMIUM_BROWSERS.map(
    (app) => `
  if (output is "") and (application "${app}" is running) then
    try
      tell application "${app}"
        if (count of windows) > 0 then
          set t to active tab of front window
          set output to (URL of t) & linefeed & (title of t)
        end if
      end tell
    end try
  end if`,
  ).join("");

  const webkit = WEBKIT_BROWSERS.map(
    (app) => `
  if (output is "") and (application "${app}" is running) then
    try
      tell application "${app}"
        if (count of documents) > 0 then
          set output to (URL of front document) & linefeed & (name of front document)
        end if
      end tell
    end try
  end if`,
  ).join("");

  return `set output to ""${chromium}${webkit}
return output`;
}

async function fromAppleScript(): Promise<ActiveTab | undefined> {
  try {
    const raw = await runAppleScript(buildAppleScript());
    const [url, ...rest] = raw.split("\n");
    if (url && looksLikeUrl(url)) {
      const title = rest.join("\n").trim();
      return { url: url.trim(), title: title || undefined };
    }
  } catch {
    // automation denied / no scriptable browser — caller falls back further
  }
  return undefined;
}

/**
 * Best-effort URL + title of the user's active browser tab.
 * Prefers the Raycast Browser Extension (broadest browser support, no
 * automation prompts), then falls back to AppleScript.
 *
 * The extension can only disambiguate windows when a single tab is active:
 * `getTabs()` reports one active tab *per window*, so with multiple windows it
 * returns several `active` tabs with no way to tell which window is focused.
 * In that case we defer to AppleScript, whose `front window` tracks the
 * actually-focused window even while Raycast is frontmost.
 */
export async function getActiveTab(): Promise<ActiveTab | undefined> {
  if (environment.canAccess(BrowserExtension)) {
    try {
      const tabs = await BrowserExtension.getTabs();
      const activeTabs = tabs.filter((tab) => tab.active);
      // Exactly one active tab means a single window — unambiguous, no prompt.
      // Zero or many means we can't tell which window is focused, so let
      // AppleScript decide via `front window`.
      if (activeTabs.length === 1) {
        const active = activeTabs[0];
        if (active.url && looksLikeUrl(active.url)) {
          return { url: active.url, title: active.title?.trim() || undefined };
        }
      } else {
        const fromScript = await fromAppleScript();
        if (fromScript) {
          return fromScript;
        }
        // AppleScript unavailable (automation denied / unsupported browser):
        // fall back to the first active tab rather than nothing.
        const active = activeTabs[0] ?? tabs[0];
        if (active?.url && looksLikeUrl(active.url)) {
          return { url: active.url, title: active.title?.trim() || undefined };
        }
      }
    } catch {
      // extension present but unreachable — fall through to AppleScript
    }
  }
  return fromAppleScript();
}
