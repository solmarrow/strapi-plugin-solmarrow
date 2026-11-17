# SolMarrow for Strapi

Send a Strapi entry to [SolMarrow](https://solmarrow.com) as a social media **draft**, straight from the Content
Manager. Open SolMarrow afterwards to pick accounts, edit and schedule it. The plugin never publishes anything.

Works with Strapi 5.

## Install

```bash
npm install strapi-plugin-solmarrow
npm run build
npm run develop
```

Strapi 5 enables installed plugins automatically.

## Set up

1. In SolMarrow open **Settings → API keys** and create a key for the workspace your drafts should go to. It starts with `smk_`.
2. In Strapi open **Settings → SolMarrow**, paste the key and press **Save**. The page shows the workspace it belongs to.
3. Optional: a **link template** adds the public page link to each draft, e.g. `https://example.com/blog/{slug}`.
   Any field of the entry can be used in braces. If a field is empty, the draft is saved without the link.

## Use it

Open an entry of one of your content types and press **Send to SolMarrow** in the right-hand panel.
The plugin sends the **saved** version (the tab you are on: draft or published) and builds the post text from:

- the title (a field called `title`, `name`, `headline` or `heading`, else the first text field),
- a short excerpt (a field called `excerpt`, `summary`, `description`, `subtitle` or `intro`, else the start of the first long text, rich text or blocks field, about 280 characters),
- the link from the link template, if set.

Private fields and fields you are not allowed to read are never used.

## Permissions

Two permissions appear under **Settings → Roles**:

- **Settings → SolMarrow → Manage the SolMarrow API key**: who may save or remove the key.
- **Plugins → SolMarrow → Send entries to SolMarrow as drafts**: who sees the panel and may send.

Super Admins have both. Senders must also be allowed to read the entry in the Content Manager.

## Network use and privacy

- The plugin talks to one service only: `https://app.solmarrow.com`, the SolMarrow API.
- It makes a request only when an admin saves a key (to check it) or presses **Send to SolMarrow**. The request carries the post text and the API key.
- No telemetry, no tracking, no other servers.
- The API key is stored in the Strapi database (plugin store) and is never sent back to the browser; the settings page shows only its last 4 characters. Remove it in Strapi and delete it in SolMarrow if you stop using the plugin.

## Develop

```bash
npm install
npm test          # unit tests (text building, requests, errors)
npm run typecheck
npm run build
npm run verify
```

## Support

Questions or problems: [open an issue](https://github.com/solmarrow/strapi-plugin-solmarrow/issues) or email support@solmarrow.com.

## License

MIT
