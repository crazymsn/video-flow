# Security Policy

## Supported versions

Video Flow is a small GitHub-only project. Security fixes are made on the latest code on `main` and, when releases are published, the latest GitHub release. Older snapshots are not supported.

## Report a vulnerability privately

Do not publish vulnerability details, exposed credentials, private video information, or transcript data through a public issue or pull request. This repository does not accept public security reports.

Use GitHub's private vulnerability reporting flow from this repository's **Security** tab when it is available. If the private reporting link is not visible, contact the repository owner through their GitHub profile and ask for a private reporting channel without including vulnerability details in the public message. Include the following only in the private report:

- the affected version or commit;
- the minimum steps needed to reproduce the problem;
- the expected and observed behavior;
- the security and privacy impact; and
- a suggested fix, if you have one.

Remove real API keys, access tokens, private URLs, transcripts, notes, and personal information. Use redacted values and public test content.

There is no guaranteed response time or bug-bounty program. Please allow a reasonable period for investigation and remediation before public disclosure.

## High-priority issues

Examples include:

- API keys or private content included in source, logs, screenshots, or release ZIPs;
- requests to network origins outside the documented YouTube, Bilibili (`www.bilibili.com`, `api.bilibili.com`, `*.hdslb.com`), Supadata (`api.supadata.ai`), and AI gateway (`api.meding.site`) hosts;
- script or HTML injection through transcript, subtitle, metadata, service errors, or model output;
- access to browsing data outside the documented YouTube and Bilibili scope;
- Bilibili cookies or credentials being read, stored, logged, or sent anywhere other than Bilibili's own hosts;
- unintended transmission of notes, transcripts, or credentials;
- a dependency or release-workflow compromise; and
- bypasses of local data deletion or the fixed AI Base URL setting.

## User security guidance

- Install only from a GitHub source or release you trust.
- Review changes and the packaged file list before loading an update.
- Use dedicated, scoped API keys and tokens where possible and set spending limits where the provider supports them.
- Remember that the AI API token and your transcript content go to a third-party gateway (`https://api.meding.site`) that is not operated by this project.
- Do not reuse keys from production systems.
- Revoke keys immediately if a device, browser profile, ZIP, log, or screenshot exposes them.
- Remember that Chrome local extension storage is not an encrypted password vault.

The release tooling uses an explicit file allowlist and scans public files for common credential patterns, but automated checks cannot detect every secret.
