import type { Core } from '@strapi/strapi';
import { Requester, SolMarrowError, createDraft, entryToText, keyPreview, keyWorkspace, linkTemplateProblem, type Attributes, type Entry } from '../lib';

type Stored = { apiKey?: string; workspaceId?: string; workspaceName?: string; linkTemplate?: string };

/** What the admin screen may see: never the key itself. */
export type PublicSettings = { connected: boolean; keyPreview: string | null; workspaceName: string | null; linkTemplate: string };

/** The only network call the plugin makes: to app.solmarrow.com, and only when an admin saves a key or sends an entry. */
const request: Requester = async (req) => {
  let res: Response;
  try {
    res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body, signal: AbortSignal.timeout(20000) });
  } catch {
    throw new SolMarrowError('Could not reach SolMarrow. Check that this server can open https://app.solmarrow.com and try again.', 502);
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
};

const solmarrow = ({ strapi }: { strapi: Core.Strapi }) => {
  const store = () => strapi.store({ type: 'plugin', name: 'solmarrow' });
  const read = async (): Promise<Stored> => ((await store().get({ key: 'settings' })) as Stored | null) ?? {};
  const write = (value: Stored) => store().set({ key: 'settings', value });
  const toPublic = (s: Stored): PublicSettings => ({
    connected: !!(s.apiKey && s.workspaceId),
    keyPreview: s.apiKey ? keyPreview(s.apiKey) : null,
    workspaceName: s.workspaceName ?? null,
    linkTemplate: s.linkTemplate ?? '',
  });

  return {
    async getSettings(): Promise<PublicSettings> {
      return toPublic(await read());
    },

    /** Saves a new key (checked against SolMarrow first) and/or the link template. An empty key keeps the saved one. */
    async saveSettings(input: { apiKey?: unknown; linkTemplate?: unknown }): Promise<PublicSettings> {
      const current = await read();
      const next: Stored = { ...current };
      if (typeof input.linkTemplate === 'string') {
        const problem = linkTemplateProblem(input.linkTemplate);
        if (problem) throw new SolMarrowError(problem);
        next.linkTemplate = input.linkTemplate.trim();
      }
      if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
        const ws = await keyWorkspace(request, input.apiKey);
        next.apiKey = input.apiKey.trim();
        next.workspaceId = ws.id;
        next.workspaceName = ws.name;
      }
      await write(next);
      return toPublic(next);
    },

    async removeKey(): Promise<PublicSettings> {
      const { linkTemplate } = await read();
      const next: Stored = { linkTemplate };
      await write(next);
      return toPublic(next);
    },

    /** Builds the post text from an entry the admin may read and saves it as a draft in SolMarrow. */
    async send(entry: Entry, attributes: Attributes, ref: string) {
      const s = await read();
      if (!s.apiKey || !s.workspaceId) throw new SolMarrowError('Add your SolMarrow API key in Settings → SolMarrow first.');
      const { text, linkSkipped } = entryToText(entry, attributes, s.linkTemplate ?? '');
      const draft = await createDraft(request, s.apiKey, s.workspaceId, text, `strapi:${ref}:${Date.now()}`);
      return { ...draft, workspaceName: s.workspaceName ?? null, linkSkipped };
    },
  };
};

export default { solmarrow };
