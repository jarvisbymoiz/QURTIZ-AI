# Local image companion (experimental)

This companion is an optional **loopback-only bridge** for a separate local OpenAI-compatible image gateway. The gateway performs ChatGPT OAuth/PKCE and stores its tokens locally; the Qurtiz companion starts that local login and returns only safe account status. Qurtiz's cloud server never connects to the gateway. API-key image generation remains the production default.

## Windows setup

1. Download the official **Qurtiz-Companion-Windows.zip** release artifact when published. Extract it to a folder on your computer.
2. Double-click **Install Qurtiz Companion.cmd**. It installs under your Windows user profile, starts in the background, and starts again when you sign in to Windows. No terminal commands, Node installation, port setup, keys or environment files are needed. Keep the PC running while generating images. Stop the companion before installing an update.
3. In Qurtiz Settings, choose **ChatGPT Account Mode** and **Connect ChatGPT**. Your default browser opens the OpenAI sign-in page. The gateway handles the local callback and stores credentials in the companion's private local data folder. The companion discovers an account-scoped Codex model catalog without generating an image, then selects a compatible image route from available capabilities. The optional web-image route is experimental and subject to its own account limit.
4. For the published Qurtiz site, your browser may ask permission to access the local network. Denying it makes this mode unavailable; choose API Mode instead.

**Distribution status:** The Windows ZIP is built locally with `npm run package:companion:win` and lands at `dist/Qurtiz-Companion-Windows.zip`. It has not been uploaded to a public release or code-signed. The Settings install link currently opens this guide; a public download link must be configured only after a vetted release artifact exists. The ZIP bundles Node and the MIT-licensed AI-Zero-Token 2.0.15 npm package. Qurtiz does not copy its OAuth configuration into the SaaS server. The default-browser launcher handles upstream's Windows browser-command lookup failure without exposing the one-use OAuth URL to Qurtiz cloud.

Settings and Content Studio contain the browser-mediated flow. Migration 0031 was applied to the configured database and schema validation passed. A published HTTPS browser test and successful image output remain necessary before calling this production-ready.

For another Qurtiz environment, apply `src/db/migrations/0031_safe_valkyrie.sql` through the repository's normal `npm run db:migrate` process before deploying the code. Verify that `image_mode_preferences` exists.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `QURTIZ_COMPANION_PORT` | `8788` | Loopback companion port |
| `QURTIZ_COMPANION_ORIGINS` | `https://qurtiz-ai.vercel.app,https://localhost:3000,http://localhost:3000` | Exact allowed browser origins, comma separated |
| `QURTIZ_IMAGE_UPSTREAM_URL` | `http://127.0.0.1:8787/v1` | Local image gateway; loopback HTTP `/v1` only |
| `QURTIZ_IMAGE_UPSTREAM_KEY` | `local` | Local gateway's API credential if it requires one; never sent to Qurtiz cloud |
| `QURTIZ_COMPANION_PAIRING_SECRET` | random at startup | Advanced local pairing seed; normal users never enter it |

The companion exposes narrow local pairing, sanitized account status, connect, disconnect, test-image, and image proxy actions. It enforces exact browser origins, a local pairing key, loopback Host, JSON payload limits, a timeout, one concurrent upstream image request, and a local request limit. It never forwards the gateway's raw admin configuration or token previews to Qurtiz. The Windows launcher uses a dedicated `%LOCALAPPDATA%\QurtizCompanion\gateway` credential store and a persistent user/workspace owner binding in `%LOCALAPPDATA%\QurtizCompanion\session.json`. **Disconnect** removes the active local OAuth profile before unpairing Qurtiz and resetting the personal image preference. If the gateway cannot remove the profile, Disconnect fails visibly and keeps the binding.

## Limits and recovery

- This works only when the browser and companion are on the same computer. A phone cannot use the companion running on a PC through this loopback-only version. A Vercel function cannot call your localhost. The Windows installer starts the companion in the background on sign-in, but background/scheduled server-side image generation is not available through this browser-mediated bridge. Mobile users can choose API Mode. Mobile ChatGPT Account Mode requires a separately authenticated and workspace-isolated cloud job relay to a running PC companion.
- Browsers differ in CORS and Local Network Access behavior. Test both the local and published Qurtiz origins before relying on it.
- A `401` from the companion means the local pairing expired; retry Connect ChatGPT. A `424` means the local gateway account needs reconnection. A `502` usually means the local gateway is unavailable or returned malformed output. A `429` can mean companion request throttling or upstream quota; inspect the local gateway for detail. Failed requests do not imply that Qurtiz saved an image.
- If a brand avatar/reference is configured, Qurtiz sends one bounded reference through JSON `/v1/images/edits` as `images[].image_url`. The gateway must support edits; otherwise the request fails visibly. Qurtiz does not silently discard the reference.
- AI-Zero-Token's Free-account web route is an explicit local opt-in, not an official OpenAI API; it can change without notice and may have stricter limits or account risk. [AI-Zero-Token API usage](https://github.com/fchangjun/AI-Zero-Token/blob/d54bd48b0912b3a7cfe3ae41d2809e4e1db98a79/docs/API_USAGE.md), [OpenAI terms](https://openai.com/policies/terms-of-use/).
