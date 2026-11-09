# Video Flow

[English](README.md) | [简体中文](README.zh-CN.md)

A Chrome side panel that turns YouTube and Bilibili videos into searchable learning notes.

- Timestamped transcripts
- Original, Chinese, and bilingual views
- AI video summaries, chapters, and key quotes
- Selected-text explanations
- Timestamped notes
- Local Chrome storage, with no analytics or telemetry

Video Flow is an unpacked extension. It is not distributed through the Chrome Web Store and uses your own API keys.

## Install

1. Download or clone this repository into a permanent folder.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. Open the extension **Settings** page.
6. Reload the extension after updating local files.

Keep the project folder in the same location. Chrome will stop loading an unpacked extension if the folder is moved or deleted.

## Configure

Video Flow can use two services:

- **Supadata**: needed only for YouTube subtitles. Create a key at [Supadata](https://dash.supadata.ai/auth/sign-up).
- **AI gateway**: used for summaries, explanations, translation, and note polishing.

The published AI Base URL is fixed:

```text
https://api.meding.site
```

Enter keys directly in Video Flow Settings. Never put keys in chat messages, source files, screenshots, or public issues.

## Use

1. Open a captioned YouTube video or a subtitled Bilibili video.
2. Click the Video Flow extension icon.
3. Read and search the transcript.
4. Open **概览** for the video summary, chapters, and key quotes.
5. Select text for an explanation or save timestamped notes.

Bilibili does not need a Supadata key. Videos without an available transcript or subtitle track may not work.

## Privacy

- Keys, settings, notes, and recent cache stay in Chrome local storage.
- YouTube transcript requests go to Supadata.
- Bilibili subtitle requests go to Bilibili services from your browser.
- AI features send the required transcript and video context to the configured gateway.
- Video Flow has no account system, analytics, advertising, or telemetry.

See [PRIVACY.md](PRIVACY.md) for the full data flow.

## Development checks

```bash
npm test
npm run check
npm run package
```

## License

MIT. See [LICENSE](LICENSE).
