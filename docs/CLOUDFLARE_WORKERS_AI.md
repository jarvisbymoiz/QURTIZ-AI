# Cloudflare Workers AI in Qurtiz AI

Cloudflare Workers AI is a preset in Workspace Settings → AI configuration.
Text and image providers can be selected independently. Enter the 32-character
Cloudflare Account ID, a server-stored Workers AI API token and a model for
each selected side. Qurtiz constructs the endpoints; users do not enter a
Cloudflare URL. The token is encrypted with the existing workspace AI config
key and never returned by the settings read action.

Text uses the official OpenAI-compatible chat base
`https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1` and an `@cf/...`
text model, for example `@cf/meta/llama-3.1-8b-instruct`. Image generation uses
the native `POST .../ai/run/@cf/...` endpoint. Any syntactically valid
`@cf/author/model` ID can be saved; Qurtiz does not keep a model allowlist.
The settings form offers examples including FLUX.1, SDXL, Leonardo and FLUX.2,
while also accepting a manually entered ID. The native adapter handles common
Workers AI response formats (binary and base64 JSON), with known input variants:

- `@cf/black-forest-labs/flux-1-schnell`: prompt input, base64 image output.
- `@cf/stabilityai/stable-diffusion-xl-base-1.0`: prompt and optional single
  `image_b64` reference input, binary image output.
- FLUX.2 family: multipart form data, including the prompt and optional
  `input_image_N` references, as required by Cloudflare's REST API.

The image adapter converts model output into a validated PNG before
the existing visual upload, Carousel slide order, Content Studio preview, and
Post Review flow. FLUX.1 schnell does not support reference images; if Brand
Brain supplies one, choose Stable Diffusion XL or remove that reference. The
adapter passes new model IDs to Cloudflare rather than rejecting them locally.
Cloudflare's own response reports unsupported model IDs or request schemas.

Create a [Workers AI API token](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
scoped to the intended account with Workers AI permission. The settings form
does not make a billable model call when saving. Use **Test saved model** to
check the saved model and token through Cloudflare's model schema API without
generating an image; save edits before testing. An invalid/revoked token,
insufficient permission, unsupported model, quota limit and malformed image
response produce distinct errors when generation is attempted.

`AI_ALLOWED_BASE_URLS` remains active for custom endpoints. Qurtiz trusts only
the exact canonical Cloudflare `/ai` and `/ai/v1` account bases without an
operator entry. If using an older deployment that still requires explicit
allowlist entries, append these two URLs with the real Account ID, retaining
existing entries:

`AI_ALLOWED_BASE_URLS=https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai,https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1`

The server rejects redirects and never forwards the token to arbitrary hosts.
Do not use a Cloudflare token as a custom provider key to bypass the preset.

Provider references: [OpenAI-compatible text](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/),
[native REST execution](https://developers.cloudflare.com/workers-ai/get-started/rest-api/),
[FLUX image schema](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/),
[Stable Diffusion XL schema](https://developers.cloudflare.com/workers-ai/models/stable-diffusion-xl-base-1.0/).
