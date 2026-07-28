/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Instance URL - Base URL of your self-hosted wytchr instance. */
  "baseUrl": string,
  /** API Token - Sent as an Authorization: Bearer token. Matches wytchr's API_TOKEN env var. */
  "apiToken": string,
  /** Default Profile - Profile/preset label applied when none is specified. */
  "defaultProfile": string,
  /** Refresh Interval (Minutes) - Review Queue triggers a background poll if wytchr hasn't refreshed within this many minutes. */
  "refreshIntervalMinutes": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `review-queue` command */
  export type ReviewQueue = ExtensionPreferences & {}
  /** Preferences accessible in the `open-wytchr` command */
  export type OpenWytchr = ExtensionPreferences & {}
  /** Preferences accessible in the `add-channel` command */
  export type AddChannel = ExtensionPreferences & {}
  /** Preferences accessible in the `add-active-tab` command */
  export type AddActiveTab = ExtensionPreferences & {}
  /** Preferences accessible in the `add-clipboard` command */
  export type AddClipboard = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `review-queue` command */
  export type ReviewQueue = {}
  /** Arguments passed to the `open-wytchr` command */
  export type OpenWytchr = {}
  /** Arguments passed to the `add-channel` command */
  export type AddChannel = {}
  /** Arguments passed to the `add-active-tab` command */
  export type AddActiveTab = {
  /** profile (e.g. tech) */
  "profile": string
}
  /** Arguments passed to the `add-clipboard` command */
  export type AddClipboard = {
  /** profile (e.g. tech) */
  "profile": string
}
}

