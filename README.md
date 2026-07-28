# Wytchr — Raycast Extension

Add YouTube channels to your self-hosted [wytchr](https://github.com/kjaymiller/wytchr) instance without leaving Raycast.

## Commands

- **Review Queue** — browse the latest "new" videos across all your channels. If wytchr hasn't polled within your configured **Refresh Interval**, it triggers a background poll and waits for it to finish before showing results. Mark videos watched, hide them, or open them, right from the list.
- **Add Channel** — a form to add a channel with an optional name override, profile, and a favorites flag. Prefills the URL from your active browser tab (falling back to a URL on the clipboard).
- **Add Active Tab Channel** — a one-shot command that adds the channel from the current browser tab immediately. Accepts an optional **profile** argument typed right in the root search.
- **Add Channel from Clipboard** — a one-shot command that grabs an `http(s)` URL from the clipboard and adds it immediately. Also accepts an optional **profile** argument.
- **Open Wytchr** — opens your instance's board in the browser.

## Reading the active tab

The browser commands resolve the current tab in two ways, in order:

1. The **[Raycast Browser Extension](https://www.raycast.com/browser-extension)** — broadest browser support (Chrome, Arc, Brave, Edge, Firefox, …) with no automation prompts. Install it for the best experience.
2. **AppleScript** fallback against running browsers — Chromium-family (Chrome, Arc, Brave, Edge, Vivaldi, Opera, …) and WebKit (Safari, Orion). macOS will ask to allow automation the first time.

If neither finds a tab, **Add Channel** falls back to a URL on the clipboard.

## Setup

Open the extension preferences and set:

| Preference      | Required | Notes                                                          |
| ---------------- | -------- | --------------------------------------------------------------- |
| Instance URL             | **yes**  | Base URL of your wytchr instance.                                |
| API Token                | **yes**  | Sent as `Authorization: Bearer <token>`, matches wytchr's `API_TOKEN`. |
| Default Profile          | no       | Profile/preset label applied when none is specified.            |
| Refresh Interval (Minutes) | no     | How stale the queue can be before **Review Queue** triggers a poll. Default `60`. |

## How it works

**Review Queue** reads `GET /api/queue`, a small JSON endpoint added to wytchr
alongside its HTML board (`app.py`) — it returns the same "new" videos the
board shows, honoring each channel's hide/shorts/title filters, plus the most
recent `last_polled_at` across channels. If that timestamp is older than the
**Refresh Interval** preference, the command calls `POST /poll/all` (the same
endpoint the web board's manual refresh uses) and polls `GET /poll/status`
until the run finishes before re-reading the queue. Marking a video watched or
hidden calls `POST /videos/<id>/watched` / `.../hide`.

The add-channel commands `POST /channels/add` on your instance, the same
endpoint the wytchr web UI's "Add Channel" form uses. wytchr resolves the URL —
channel, `/@handle`, or video URL — to its channel server-side, so any of
those shapes work as input.

Because that endpoint is an HTML form handler rather than a JSON API, it always
responds with a redirect: to `/` on success, or back to the add form with an
`error` query param on failure (e.g. "already subscribed"). The extension
follows that redirect manually to surface the right result.

## Development

```bash
npm install
npm run dev      # launches the extension in Raycast (requires the Raycast app)
npm run build
npm run lint
```
