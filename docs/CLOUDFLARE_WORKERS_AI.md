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
the native `POST .../ai/run/@cf/...` endpoint. The supported image adapters are:

- `@cf/black-forest-labs/flux-1-schnell`: prompt input, base64 image output.
- `@cf/stabilityai/stable-diffusion-xl-base-1.0`: prompt and optional single
  `image_b64` reference input, binary image output.

The image adapter converts either model's output into a validated PNG before
the existing visual upload, Carousel slide order, Content Studio preview, and
Post Review flow. FLUX.1 schnell does not support reference images; if Brand
Brain supplies one, choose Stable Diffusion XL or remove that reference. The
adapter reports unsupported model shapes rather than sending an OpenAI Images
request to Cloudflare.

Create a [Workers AI API token](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
scoped to the intended account with Workers AI permission. The settings form
does not make a billable model call when saving. An invalid/revoked token,
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
