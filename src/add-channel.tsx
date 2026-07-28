import { Action, ActionPanel, Clipboard, Form, Icon, Toast, showHUD, showToast } from "@raycast/api";
import { getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { addChannel, looksLikeUrl, Preferences } from "./api";
import { getActiveTab } from "./browser";

interface FormValues {
  url: string;
  name: string;
  profile: string;
  addToFavs: boolean;
}

export default function AddChannel() {
  const prefs = getPreferenceValues<Preferences>();
  const [urlError, setUrlError] = useState<string | undefined>();
  const [defaultUrl, setDefaultUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [tab, clip] = await Promise.allSettled([getActiveTab(), Clipboard.readText()]);

      // Prefer the active browser tab; fall back to a URL on the clipboard.
      if (tab.status === "fulfilled" && tab.value) {
        setDefaultUrl(tab.value.url);
      } else if (clip.status === "fulfilled" && clip.value && looksLikeUrl(clip.value)) {
        setDefaultUrl(clip.value.trim());
      }
      setIsLoading(false);
    })();
  }, []);

  async function handleSubmit(values: FormValues) {
    const url = values.url.trim();
    if (!url) {
      setUrlError("URL is required");
      return;
    }
    if (!looksLikeUrl(url)) {
      setUrlError("Must be a valid http(s) URL");
      return;
    }

    const toast = await showToast({ style: Toast.Style.Animated, title: "Adding channel…" });
    try {
      const result = await addChannel({
        url,
        name: values.name.trim() || undefined,
        profile: values.profile.trim() || prefs.defaultProfile?.trim() || undefined,
        addToFavs: values.addToFavs,
      });
      // HUD survives the window closing, so the user always sees confirmation.
      await showHUD(`✓ Added channel — ${result.name || url}`);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to add channel";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Video} title="Add Channel" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="Channel URL"
        placeholder="https://www.youtube.com/@channel"
        defaultValue={defaultUrl}
        error={urlError}
        onChange={() => urlError && setUrlError(undefined)}
        onBlur={(event) => {
          const v = event.target.value?.trim();
          if (v && !looksLikeUrl(v)) setUrlError("Must be a valid http(s) URL");
        }}
        info="Accepts a channel, handle, or video URL — wytchr resolves it to the channel."
      />
      <Form.TextField id="name" title="Name" placeholder="Optional — derived from the channel handle if left blank" />
      <Form.TextField
        id="profile"
        title="Profile"
        placeholder="Optional preset/profile label"
        defaultValue={prefs.defaultProfile ?? ""}
      />
      <Form.Checkbox id="addToFavs" title="Favorites" label="Also add to favorites" defaultValue={false} />
    </Form>
  );
}
