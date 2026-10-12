# Developer docs

The site at developer.syntropi.co.uk: guides in `content/*.md` and the API reference from `openapi.yaml` (rendered with Redoc).

```bash
npm run build -w @syntropi/developer-docs      # writes dist/
npx serve apps/developer-docs/dist             # look at it locally
```

## Keeping it accurate

Both the spec and the guides are written by hand. `apps/api-worker/test/openapi.test.ts` fails if they stop matching the API:
a documented endpoint that does not exist, an endpoint that is not documented, a different status or ISO code list, an example the API would reject,
a response field that is undocumented, an error code in the Errors guide that the API does not return, or a wrong ISO mapping row.
When you change the API, change the spec and the guides in the same commit.

## Deploying

It is a static site in the Vercel project `syntropi-docs` (domain developer.syntropi.co.uk), not connected to Git:

```bash
cd apps/developer-docs && npm run build
cd dist && vercel link --yes --project syntropi-docs && vercel deploy --prod --yes
```

`dist/vercel.json` sets `X-Robots-Tag: noindex, nofollow` (nothing on the Syntropi domain should be indexed by search engines).
