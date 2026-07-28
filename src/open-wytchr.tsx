import { getPreferenceValues, open } from "@raycast/api";
import { Preferences } from "./api";

export default async function OpenWytchr() {
  const prefs = getPreferenceValues<Preferences>();
  const baseUrl = prefs.baseUrl.trim().replace(/\/+$/, "");
  await open(baseUrl);
}
