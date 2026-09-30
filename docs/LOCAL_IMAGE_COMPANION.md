# Local image companion (experimental)

This companion keeps ChatGPT OAuth/PKCE and its tokens on a Windows PC. The browser uses loopback only once to pair that PC and start local login. Image requests use a durable Qurtiz cloud job; the companion makes outbound HTTPS requests, generates locally, uploads binary to a signed Supabase Storage URL, and reports completion. Qurtiz cloud never receives ChatGPT OAuth credentials. API-key image generation remains the production default.

## Windows setup

1. Download the official **Qurtiz-Companion-Windows.zip** release artifact when published. Extract it to a folder on your computer.
2. Double-click **Install Qurtiz Companion.cmd**. It installs under your Windows user profile, starts in the background, and starts again when you sign in to Windows. No terminal commands, Node installation, port setup, keys or environment files are needed. Keep the PC running while generating images. Stop the companion before installing an update.
3. On the PC, open Qurtiz Settings, choose **ChatGPT Account Mode**, then **Pair this computer** and **Connect ChatGPT**. Your default browser opens the OpenAI sign-in page. The local gateway handles the callback and stores ChatGPT credentials in the companion's private local data folder. The companion discovers account capabilities without spending image quota.
4. Once paired, the PC companion runs with the browser closed. Qurtiz on Android or another PC can enqueue image jobs for that device as long as it is powered, online, and logged in to ChatGPT. The paired PC must be online to finish an image job. Pairing itself still requires the browser and companion on the same PC and may need browser local-network permission.

**Distribution status:** The Windows ZIP is built locally with `npm run package:companion:win` and lands at `dist/Qurtiz-Companion-Windows.zip`. It has not been uploaded to a public release or code-signed. The Settings install link currently opens this guide; a public download link must be configured only after a vetted release artifact exists. The ZIP bundles Node and the MIT-licensed AI-Zero-Token 2.0.15 npm package. Qurtiz does not copy its OAuth configuration into the SaaS server. The default-browser launcher handles upstream's Windows browser-command lookup failure without exposing the one-use OAuth URL to Qurtiz cloud.

Migrations 0032–0033 add devices, pairing challenges, image jobs, Auto Run fallback settings and safe device/member deletion behavior. They were applied to the configured database and schema validation passed. A public companion release, deployed relay build, and real Production/mobile/Auto Run image tests remain necessary before calling this production-ready.

For another Qurtiz environment, apply migrations through `0033_companion_device_lifecycle.sql` using the repository's normal `npm run db:migrate` process before deploying the code. Verify the device and image job tables with `npm run db:validate`.

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

- Pairing and ChatGPT OAuth start on the PC where the companion runs. Image jobs no longer require that browser or computer: mobile and Auto Run can enqueue work through the cloud. Real deployed mobile and browser-closed verification is still pending. A Vercel function never calls the user's localhost.
- Production is an allowed companion origin by default. A separate Preview deployment must either share the Production database and already paired device, or use a companion build configured with that exact Preview origin. Arbitrary `*.vercel.app` origins are intentionally not trusted.
- Browsers differ in CORS and Local Network Access behavior. Test both the local and published Qurtiz origins before relying on it.
- A `401` from the companion means the local pairing expired; retry Connect ChatGPT. A `424` means the local gateway account needs reconnection. A `502` usually means the local gateway is unavailable or returned malformed output. A `429` can mean companion request throttling or upstream quota; inspect the local gateway for detail. Failed requests do not imply that Qurtiz saved an image.
- If a brand avatar/reference is configured, Qurtiz sends one bounded reference through JSON `/v1/images/edits` as `images[].image_url`. The gateway must support edits; otherwise the request fails visibly. Qurtiz does not silently discard the reference.
- AI-Zero-Token's Free-account web route is an explicit local opt-in, not an official OpenAI API; it can change without notice and may have stricter limits or account risk. [AI-Zero-Token API usage](https://github.com/fchangjun/AI-Zero-Token/blob/d54bd48b0912b3a7cfe3ae41d2809e4e1db98a79/docs/API_USAGE.md), [OpenAI terms](https://openai.com/policies/terms-of-use/).
