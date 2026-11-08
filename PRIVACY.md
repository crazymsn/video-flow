# Privacy

Effective: July 28, 2026

Video Flow is a GitHub-only, bring-your-own-key Chrome extension for YouTube and Bilibili. It has no Video Flow account, developer-operated backend, analytics, advertising, or telemetry.

## Data the extension handles

Depending on the feature you use, Video Flow handles:

- the canonical URL and video ID of the active YouTube video, or the BV id and part (cid) of the active Bilibili video;
- transcript text and timestamps;
- video metadata such as title, channel, description, and duration;
- text you select in the transcript and nearby transcript context;
- transcript context around a timestamped note;
- content you ask to translate;
- notes you save;
- Supadata and AI gateway configuration, including the Supadata API key and the AI API token; and
- cached transcript, digest, and translation results.

## Where data goes

### Supadata (YouTube only)

For YouTube videos, Video Flow sends the canonical YouTube watch URL to `https://api.supadata.ai` with your Supadata API key. Supadata returns the transcript and timestamps. A Supadata key is required for YouTube transcript retrieval and is not used for Bilibili.

### Bilibili

For Bilibili videos, Video Flow does not use Supadata or any transcript key. The extension calls Bilibili's own web API directly from your browser:

- requests to `https://api.bilibili.com` include your Bilibili cookies (credentials included), the same way the Bilibili web page does. They carry the BV id, the part id (cid), and a WBI signing key obtained from Bilibili's nav endpoint;
- subtitle files are downloaded from Bilibili's subtitle CDN under `hdslb.com`.

Only videos that actually have a subtitle track (uploader CC subtitles or Bilibili AI subtitles) work. Bilibili AI subtitles often require you to be logged in to Bilibili. Video Flow never transcribes audio.

Video Flow does not read, store, or send Bilibili credentials anywhere else. Your cookies are attached by Chrome to requests to Bilibili's own hosts only. Bilibili processes these requests under its own terms and privacy policy.

### AI gateway (api.meding.site)

AI features use an OpenAI-compatible Chat Completions API at the fixed Base URL `https://api.meding.site`. Requests go to `https://api.meding.site/v1/chat/completions`, and the model list is fetched from `https://api.meding.site/v1/models`. The following is sent to this third-party gateway, together with your API token:

- transcript plus relevant title, channel, description, or duration for an overview;
- selected text plus nearby transcript context for an explanation;
- small semantic transcript batches currently needed for progressive Chinese
  translation, or requested overview or explanation content;
- nearby transcript context and video metadata when polishing a saved note.

The Base URL is fixed in the published Settings page and cannot be changed there. You provide one API token and choose a model from the fetched list (or type a model name manually). There is no default model. To use another gateway or model, you must adapt your own local source copy and its permissions. Never include an API key in a coding-agent prompt or chat.

Video Flow's developer does not operate this gateway, does not proxy or receive these requests, and does not collect payments or resell access. The gateway operator's terms, privacy policy, retention practices, and your account settings there apply to everything sent to it. Usage and pricing are governed by the gateway operator and your own account.

Requests go directly from the extension to Supadata, Bilibili, or the AI gateway, and are authenticated with the keys, tokens, or cookies described above. Those services process data under their own terms. Do not send confidential, personal, or regulated content unless their terms and your obligations permit it.

### Earlier versions

Earlier versions supported DeepSeek. An old DeepSeek key saved by an earlier version is cleared the first time you open Settings. You must enter a new API token.

## Local storage and retention

Video Flow uses Chrome's local extension storage, not a Video Flow cloud service.

- Supadata and AI gateway settings, the Supadata API key, and the AI API token remain on the device in Chrome's extension storage.
- Saved notes remain until you delete them or remove/clear the extension's data. The extension keeps up to 100 notes.
- Recent transcript, digest, and per-segment translation cache entries are stored
  locally. The cache is limited to 20 videos, and entries older than 30 days are
  removed when the side panel opens.

Chrome extension storage is not a password vault. Anyone with sufficient access to your browser profile or device may be able to recover locally stored keys or content. Use scoped keys where providers support them, set spending limits where available, and rotate or revoke a key if the device or browser profile is compromised.

To remove data:

- delete individual saved notes in Video Flow;
- use the Options page to clear cached digests, delete all notes, or reset all extension data;
- remove the extension or clear its stored data from Chrome to delete all local settings, keys, notes, and cache entries; and
- revoke keys in the Supadata dashboard or on the AI gateway to stop their future use.

Clearing local data does not delete information already processed or retained by Supadata, Bilibili, or the AI gateway. Use each service's controls for service-side requests.

## Permissions

Video Flow uses Chrome permissions for these purposes:

- `sidePanel`: display the Video Flow interface beside the video page.
- `storage`: store settings, keys, notes, and cached results locally.
- `tabs`: identify and interact with the active YouTube or Bilibili tab.
- `scripting`: coordinate the extension's page controls on YouTube and Bilibili.

Host access:

- `https://www.youtube.com/*`: read the active video's URL and metadata and provide timestamp controls.
- `https://www.bilibili.com/*`: read the active Bilibili video page and provide timestamp controls.
- `https://api.bilibili.com/*`: request Bilibili video information and subtitle metadata, with your Bilibili cookies.
- `https://*.hdslb.com/*`: download Bilibili subtitle files.
- `https://api.supadata.ai/*`: retrieve YouTube transcripts.
- `https://api.meding.site/*`: provide AI overviews, explanations, translation, and note polishing, and list available models.

Video Flow does not use these permissions to monitor general browsing activity.

## No sale or advertising use

Video Flow does not sell personal information, build advertising profiles, or share data with data brokers. It does not include analytics SDKs.

## Changes

Privacy-relevant changes will be documented in this file and in the repository history. Review updates before installing a new version.

## Questions

This repository does not provide a public support or issue channel. Review this policy, the source code, and each provider's documentation before using the extension. For a vulnerability or accidental secret exposure, follow the private process in [SECURITY.md](SECURITY.md).
