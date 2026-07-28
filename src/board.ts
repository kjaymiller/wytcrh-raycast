export interface QueueVideo {
  id: string;
  title: string;
  url: string;
  status: string;
  channel: string;
  channelDisplayName: string;
  profile: string | null;
  thumbnailUrl: string | null;
  duration: string | null;
  uploadDate: Date | null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .trim();
}

function parseUploadDate(text: string): Date | null {
  const trimmed = text.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

const CHANNEL_ROW_RE =
  /<article class="channel-row" data-channel="([^"]*)" data-profile="([^"]*)">([\s\S]*?)<div class="videos">/g;
const CHANNEL_TITLE_RE = /<a class="title"[^>]*title="([^"]*)"[^>]*>([^<]*)<\/a>/;
const CARD_RE =
  /<article class="card" data-status="([^"]*)" data-favorited="[^"]*" id="card-([^"]*)">([\s\S]*?)<\/article>/g;
const CARD_THUMB_RE = /<img class="thumb" src="([^"]*)"/;
const CARD_TITLE_RE = /<div class="title">\s*<a href="([^"]*)"[^>]*>([^<]*)<\/a>/;
const CARD_META_RE = /<div class="meta">\s*<span>([^<]*)<\/span>\s*<span>([^<]*)<\/span>/;

interface ChannelInfo {
  index: number;
  name: string;
  displayName: string;
  profile: string | null;
}

/**
 * Extracts videos from a rendered /board (or /favorites) page — the same
 * HTML the web UI itself consumes. There's no JSON API for this, so we
 * parse the markup directly rather than maintaining a shadow endpoint that
 * has to be kept in sync with every board template change.
 */
export function parseBoardVideos(html: string): QueueVideo[] {
  const channels: ChannelInfo[] = [];
  for (const match of html.matchAll(CHANNEL_ROW_RE)) {
    const [, name, profile, header] = match;
    const titleMatch = CHANNEL_TITLE_RE.exec(header);
    channels.push({
      index: match.index + match[0].length,
      name,
      displayName: titleMatch ? decodeHtmlEntities(titleMatch[2]) : name,
      profile: profile.trim() || null,
    });
  }

  function channelFor(cardIndex: number): ChannelInfo | undefined {
    let owner: ChannelInfo | undefined;
    for (const channel of channels) {
      if (channel.index <= cardIndex) owner = channel;
      else break;
    }
    return owner;
  }

  const videos: QueueVideo[] = [];
  for (const match of html.matchAll(CARD_RE)) {
    const [, status, id, body] = match;
    const channel = channelFor(match.index);
    const thumbMatch = CARD_THUMB_RE.exec(body);
    const titleMatch = CARD_TITLE_RE.exec(body);
    const metaMatch = CARD_META_RE.exec(body);
    if (!titleMatch) continue;

    videos.push({
      id,
      status,
      title: decodeHtmlEntities(titleMatch[2]),
      url: titleMatch[1],
      channel: channel?.name ?? "",
      channelDisplayName: channel?.displayName ?? "",
      profile: channel?.profile ?? null,
      thumbnailUrl: thumbMatch ? thumbMatch[1] : null,
      duration: metaMatch ? metaMatch[2].trim() || null : null,
      uploadDate: metaMatch ? parseUploadDate(metaMatch[1]) : null,
    });
  }

  return videos;
}
