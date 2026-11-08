# Video Flow

[English](README.md) | [简体中文](README.zh-CN.md)

Turn every YouTube and Bilibili video into a resource for deep learning. Video Flow brings transcripts, bilingual translation, AI overviews, explanations, and timestamped notes into one Chrome side panel, so you can study ideas and language without losing your place.

- Turn captions into a readable, searchable learning resource.
- Learn languages with the original transcript, a Simplified Chinese translation, or an aligned bilingual view.
- Build understanding with an AI overview, chapters, key quotes, and selected-text explanations.
- Navigate long videos by clicking timestamps in the transcript, overview, or notes.
- Save polished timestamped notes for later study.
- Keep control of your data with your own API keys, local Chrome storage, and no analytics or telemetry.

Video Flow is a bring-your-own-key project installed locally from GitHub. It is not available through the Chrome Web Store, does not include API credits, and does not run a developer-operated server. It works on YouTube watch pages and Bilibili video pages.

![Video Flow demo](Video%20Flow%20demo.png)

## New in v1.3.0

- Bilibili support: digest `bilibili.com/video/BV...` pages, including multi-part videos, with no transcript key.
- One AI mode: an OpenAI-compatible API at a fixed Base URL. You enter only an API token, and Settings loads the model list for you.
- DeepSeek support was removed.

## Earlier in v1.2.0

- Search transcript words or phrases and move through every match.
- Use one Original, Chinese, or bilingual setting across Transcript, Overview, and Notes. New videos stay in Original by default.
- Translate visible Overview and Notes content progressively in small cached batches.
- Explain selected transcript text or save it directly as a timestamped note.
- Keep your transcript position across navigation, with the panel closing automatically outside supported video pages.

## Install with your coding agent

You do not need to understand the code or use the command line. Send this message to your coding agent:

> Download or clone this project into a permanent folder I choose, tell me its exact full path, and use that same folder for Chrome's Load unpacked step. If I need a suggestion during this first installation, offer `~/Documents/video-flow` on macOS or Linux, or `%USERPROFILE%\Documents\video-flow` on Windows, but do not assume either path. Walk me through installation and setup in simple terms. https://github.com/crazymsn/video-flow

Your agent should:

1. Ask where you want to keep the project, download or clone it there, and tell you the exact full path. If you want a suggestion, it can offer `~/Documents/video-flow` on macOS or Linux, or `%USERPROFILE%\Documents\video-flow` on Windows.
2. Open the official Supadata page below if you want to use YouTube, and help you create your own account. Bilibili does not need a Supadata key.
3. Walk you through selecting the exact project folder you chose in Chrome with **Load unpacked**.
4. Show you where to enter your Supadata key (YouTube only) and your AI API token in the extension's **Settings** page.
5. Open a YouTube or Bilibili video with captions and confirm the transcript and translation work.

Keep this folder in the same place after installation. If you move or delete it, Chrome's unpacked extension stops working until you load the extension again from its new permanent folder.

Never paste an API key into an AI chat, source file, screenshot, or public message. Enter keys yourself, directly in the Video Flow Settings page. Your coding agent can point to the correct field without seeing the key.

## Install manually

If you prefer to do it yourself:

1. Open [github.com/crazymsn/video-flow](https://github.com/crazymsn/video-flow).
2. Choose **Code**, then **Download ZIP**.
3. Choose a permanent folder and unzip the project there. Optional suggestions are `~/Documents/video-flow` on macOS or Linux, or `%USERPROFILE%\Documents\video-flow` on Windows. You may use a different folder.
4. In Chrome, open `chrome://extensions`.
5. Turn on **Developer mode**.
6. Click **Load unpacked**.
7. Select the exact project folder you chose, which must contain `manifest.json`.
8. Pin Video Flow from Chrome's Extensions menu if you want quick access.

Because this is an unpacked extension, it does not update automatically. After downloading an update or changing local files, click **Reload** on the Video Flow card at `chrome://extensions`, then refresh open YouTube and Bilibili tabs. Moving or deleting the source folder breaks the unpacked extension until you load it again from the new location.

## Set up your API keys

Video Flow uses up to two keys:

1. A **Supadata API key** to retrieve YouTube transcripts. It is only needed for YouTube. Bilibili videos do not use Supadata and need no transcript key.
2. An **AI API token** for an OpenAI-compatible gateway, used for overviews, explanations, translation, and automatic note polishing.

### Get a Supadata API key (YouTube only)

1. Open the official [Supadata sign-up page](https://dash.supadata.ai/auth/sign-up).
2. Create an account and complete the short onboarding flow.
3. Supadata generates an API key automatically during onboarding.
4. Open the [Supadata dashboard](https://dash.supadata.ai/) whenever you need to find or manage the key.
5. Copy the key and paste it into **Supadata API key** in Video Flow Settings.

See the [official Supadata documentation](https://docs.supadata.ai/) if the dashboard flow changes.

### Enter your AI API token

Video Flow uses an OpenAI-compatible Chat Completions API at a fixed Base URL:

```text
Base URL: https://api.meding.site
Chat endpoint: https://api.meding.site/v1/chat/completions
Model list: https://api.meding.site/v1/models
```

1. Open **Settings** from the side panel. You can also open the Video Flow **Options** page from its card at `chrome://extensions` or by right-clicking its toolbar icon.
2. The Base URL is shown read-only and cannot be changed.
3. Paste your API token into the API key field. Use a token from your own account on that gateway.
4. Settings then fetches the model list from `/v1/models` automatically. Pick a model from the list. If fetching fails, you can type a model name manually.
5. There is no default model, so choose one before using AI features.

Usage and pricing are governed by the gateway operator and your own account there. Video Flow does not collect payments or resell access.

Paste keys only into these Settings fields. Never paste a key into an AI chat, repository file, screenshot, or public message. To use a different gateway or model, copy the safe customization prompt in Settings and give it to a coding agent for your local copy. Never add an API key to that prompt or chat.

If you used an earlier version that saved a DeepSeek key, it is cleared the first time you open Settings. Enter a new token.

Keys and settings are stored in Chrome's local extension storage on your device. Release builds do not include or use `config.js`.

## Use Video Flow

1. Open a standard YouTube watch page, or a Bilibili video page (`bilibili.com/video/BV...`), that has captions or subtitles.
2. Click the Video Flow extension icon to open the side panel.
3. Read the timestamped transcript, or choose **Original**, **中文**, or **双语**.
4. Open **Overview** when you want AI-generated chapters and key quotes.
5. Select transcript text when you want an AI explanation.
6. Save a note from the player or a key quote, then revisit it from **Notes**.

## What works today

- Google Chrome 116 or newer, using the Side Panel API.
- Standard `youtube.com/watch` video pages.
- Bilibili `bilibili.com/video/BV...` pages, including multi-part videos.
- On YouTube, native subtitle tracks returned by Supadata. Video Flow prefers English when available, but may show another native language.
- On Bilibili, subtitle tracks that the video actually has: uploader CC subtitles or Bilibili AI subtitles. Manual subtitles are preferred over AI ones, then Chinese, then English.
- Original, Simplified Chinese, and aligned bilingual transcript views.
- AI overviews, selected-text explanations, translation, and automatic note polishing through an OpenAI-compatible API at the fixed Base URL `https://api.meding.site`.
- Local notes and a local cache for recent transcript and digest results.

Shorts, live streams, private or access-restricted videos, and videos without an available transcript or subtitle track may not work. Firefox, Safari, mobile browsers, and other Chromium browsers are not currently tested or supported.

On YouTube, Video Flow forces Supadata's `mode=native`. It does not request AI-generated transcripts or perform local audio transcription when native captions are unavailable.

On Bilibili, Video Flow does not use Supadata or any transcript key. The extension calls Bilibili's own web API (`api.bilibili.com`) directly from your browser, using your logged-in Bilibili cookies, and downloads the subtitle file from Bilibili's subtitle CDN (`*.hdslb.com`). Bilibili AI subtitles often require you to be logged in to Bilibili. The extension never transcribes audio, so a video with no subtitle track will not work.

## Supadata free tier and request costs

Current as of August 9, 2026, the [Supadata pricing page](https://supadata.ai/pricing) lists a free tier with **100 credits per month**, no credit card required. Unused credits do not roll over. Supadata pricing can change, so check the current page before relying on these numbers.

The [Supadata transcript documentation](https://docs.supadata.ai/get-transcript) describes the transcript request modes and credit behavior:

- A native transcript request uses **1 credit**, regardless of video duration.
- A generated transcript costs **2 credits per video minute**. Video Flow does not use this path because it forces `mode=native`.
- An unavailable native lookup returned as HTTP `206` still uses **1 credit**.

With the current native-only behavior, the free tier can cover roughly 100 transcript lookups per month when each request succeeds once. Retries and unavailable-caption lookups also consume credits, so actual successful-video coverage can be lower.

Supadata is only used for YouTube. AI usage is separate and is governed by the gateway operator and your own account there. Video Flow does not collect payments or resell access. Check the limits on your accounts and monitor your usage.

## Remix it with your coding agent

This is a personal remix project. Upstream issues and pull requests are not accepted. If something breaks or you want a new feature, download or fork your own copy and ask your coding agent to fix, remix, or personalize it for you.

Video Flow uses plain HTML, CSS, and JavaScript with no build step, so it is a friendly starting point for agent-assisted projects. Ideas to try:

- Add more translation languages and let each person choose a learning language.
- Create customized summary templates for lectures, interviews, tutorials, reviews, or research talks.
- Build a vocabulary notebook that saves a word, its sentence, meaning, and video timestamp.
- Export notes and vocabulary to Markdown, CSV, Anki, or another study tool.
- Add personal topic filters that highlight the chapters most relevant to a goal.
- Add optional local-model support for a different privacy and cost tradeoff.
- Improve accessibility with keyboard navigation, font controls, and higher-contrast themes.

Ask your agent to preserve the bring-your-own-key model, keep secrets out of source files, run the checks below, and test the remix on real videos.

The Base URL is fixed in the published version. If you want to point your local copy at another OpenAI-compatible gateway or provider, first open the exact Video Flow project folder that Chrome loaded through **Load unpacked** in your coding agent. Then open Video Flow Settings and use **Copy customization prompt**. Replace the `[PROVIDER]` and `[MODEL]` placeholders before sending it. Do not include any API key in the prompt or chat. After the agent updates your local copy, enter the key yourself in the Settings field it identifies.

## Privacy and data flow

Video Flow makes provider requests directly from the extension:

1. For YouTube, it sends a canonical watch URL and your Supadata key to Supadata (`api.supadata.ai`) to request the native transcript.
2. For Bilibili, it calls `api.bilibili.com` with your Bilibili cookies, as the Bilibili web page does, and downloads subtitle files from `hdslb.com`. No Bilibili credentials are read, stored, or sent anywhere else.
3. It sends the transcript, relevant video metadata, and your API token to the AI gateway at `https://api.meding.site` when you request AI features.
4. Focused features send only the content they need, such as selected text with context or small transcript batches for translation.
5. It stores keys, settings, notes, and recent cache entries locally in Chrome.

There is no Video Flow account system, advertising, analytics, or telemetry. Supadata, Bilibili, and the AI gateway still receive data under their own terms and privacy policies. See [PRIVACY.md](PRIVACY.md) for details.

## Troubleshooting

### The Flow button is missing on a YouTube or Bilibili video

- At `chrome://extensions`, find Video Flow and click **Reload**, then refresh the video tab.
- Confirm that you are on a standard `https://www.youtube.com/watch?...` page or a `https://www.bilibili.com/video/BV...` page, not a Short, embed, or live page.
- The current version automatically follows the page when its responsive action bar changes. Wait a moment after the page finishes loading.
- If you have an older downloaded copy, resizing the YouTube window horizontally once may reveal the button. Then download the latest version so resizing is no longer required.
- If it is still missing, ask your coding agent to inspect the content script on that exact video page.

### The side panel does not open

- Confirm that you are on a standard `https://www.youtube.com/watch?...` or `https://www.bilibili.com/video/BV...` page.
- At `chrome://extensions`, confirm Video Flow is enabled and click **Reload**.
- Refresh the video tab after reloading the extension.
- Ask your coding agent to inspect the extension if the problem continues.

### Video Flow asks for setup

- Open **Settings** and enter your AI API token. For YouTube videos, also save a Supadata key.
- The Base URL is fixed and shown read-only. Pick a model from the fetched list, or type a model name manually if fetching fails. There is no default model.
- If a DeepSeek key was saved by an earlier version, it was cleared the first time you opened Settings. Enter a new token.

### No transcript is found

- On YouTube, confirm the video is public and has native captions. Check your Supadata key, remaining credits, rate limit, and account status. Unavailable native lookups and manual retries may still consume credits.
- On Bilibili, confirm the video has a subtitle track (uploader CC subtitles or Bilibili AI subtitles). Bilibili AI subtitles often require you to be logged in to Bilibili in the same Chrome profile.

Video Flow will not fall back to generated transcription or audio transcription.

### AI requests fail

- A `401` or `403` usually means the API token or account access is invalid.
- A `429` usually means a rate or usage limit was reached on the gateway.
- Confirm the token belongs to your account on the gateway and that the account has available quota.
- If model fetching fails, type a model name manually and check that it is available to your account.
- If you adapted a local copy for another gateway, use the Settings customization prompt again and ask your coding agent to inspect that local implementation.

Never share API keys, private transcripts, or personal notes in chats, screenshots, or logs.

## Checks for coding agents

Ask your coding agent to run these commands after changing the project:

```bash
npm test
npm run check
npm run package
```

The agent should also reload the unpacked extension in Chrome and test several real YouTube and Bilibili videos. Automated checks do not prove that live provider requests and page interactions work.

## Acknowledgements

Bilibili support is adapted from [biuworks/bilibili-digest](https://github.com/biuworks/bilibili-digest) (MIT), which is itself derived from [zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest) (MIT).

## License

MIT. See [LICENSE](LICENSE).
