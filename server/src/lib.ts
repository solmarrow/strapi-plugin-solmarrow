// Pure logic: no Strapi imports, so it can be tested with plain node.

export const API_URL = 'https://app.solmarrow.com/api/v1';
export const APP_URL = 'https://app.solmarrow.com';

/** Longest excerpt taken from an entry; the draft is edited in SolMarrow anyway. */
export const EXCERPT_MAX = 280;

export type Attribute = { type?: string; private?: boolean };
export type Attributes = Record<string, Attribute>;
export type Entry = Record<string, unknown>;

export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
}
export interface HttpResponse {
  status: number;
  json: unknown;
}
export type Requester = (req: HttpRequest) => Promise<HttpResponse>;

export class SolMarrowError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function isApiKey(value: unknown): value is string {
  return typeof value === 'string' && /^smk_[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

/** "smk_…a1b2": enough to recognise a key, never enough to use it. */
export function keyPreview(key: string): string {
  const k = key.trim();
  return `smk_…${k.slice(-4)}`;
}

/** A link template must be https and may use {field} placeholders, e.g. https://example.com/blog/{slug}. */
export function linkTemplateProblem(template: string): string | null {
  const t = template.trim();
  if (!t) return null;
  if (t.length > 500) return 'The link template is too long (500 characters at most).';
  if (!/^https:\/\/[^\s{}]+/i.test(t)) return 'The link template must start with https:// and a domain.';
  if (/\s/.test(t)) return 'The link template cannot contain spaces.';
  if (!/^(?:[^{}]|\{[A-Za-z_][A-Za-z0-9_]*\})*$/.test(t)) return 'Placeholders look like {slug}: letters, digits and _ only.';
  return null;
}

/** Reads a nested string or number from an unknown JSON value. */
export function pick(value: unknown, ...path: string[]): string | null {
  let cur: unknown = value;
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null) return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'string' || typeof cur === 'number' ? String(cur) : null;
}

/** Plain text from Strapi's Blocks editor JSON (paragraphs, headings, lists, quotes, code, links). */
export function blocksToText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  const inline = (nodes: unknown): string =>
    Array.isArray(nodes)
      ? nodes
          .map((n) => {
            if (typeof n !== 'object' || n === null) return '';
            const node = n as Record<string, unknown>;
            if (typeof node.text === 'string') return node.text;
            return inline(node.children);
          })
          .join('')
      : '';
  const block = (b: unknown): string => {
    if (typeof b !== 'object' || b === null) return '';
    const node = b as Record<string, unknown>;
    if (node.type === 'image') return '';
    if (node.type === 'list' && Array.isArray(node.children)) return node.children.map((li) => `- ${inline((li as Record<string, unknown>)?.children)}`).join('\n');
    return inline(node.children);
  };
  return value.map(block).filter((t) => t.trim()).join('\n\n');
}

/** Plain text from Markdown or HTML (Strapi's rich text field may hold either). */
export function markupToText(value: string): string {
  return value
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/`{1,3}/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Cuts at a word boundary and adds "…" when the text is longer than max. */
export function shorten(text: string, max = EXCERPT_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

const TITLE_NAMES = ['title', 'name', 'headline', 'heading', 'label'];
const EXCERPT_NAMES = ['excerpt', 'summary', 'description', 'subtitle', 'intro', 'introduction', 'lead', 'teaser', 'abstract'];
const isPlain = (a?: Attribute) => !!a && !a.private && (a.type === 'string' || a.type === 'text');
const isLong = (a?: Attribute) => !!a && !a.private && (a.type === 'text' || a.type === 'richtext' || a.type === 'blocks');

function fieldText(entry: Entry, name: string, attr: Attribute | undefined): string {
  const v = entry[name];
  if (attr?.type === 'blocks') return blocksToText(v);
  if (typeof v !== 'string') return '';
  return attr?.type === 'richtext' ? markupToText(v) : v.trim();
}

function findField(attrs: Attributes, names: string[], ok: (a?: Attribute) => boolean): string | null {
  const lower = new Map(Object.keys(attrs).map((k) => [k.toLowerCase(), k]));
  for (const n of names) {
    const k = lower.get(n.toLowerCase());
    if (k && ok(attrs[k])) return k;
  }
  return null;
}

/** Fills {field} placeholders from the entry. Returns null if any placeholder has no value. */
export function fillTemplate(template: string, entry: Entry): string | null {
  const t = template.trim();
  if (!t) return null;
  let missing = false;
  const out = t.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    const v = entry[name];
    if ((typeof v === 'string' && v.trim()) || typeof v === 'number') return encodeURIComponent(String(v).trim());
    missing = true;
    return '';
  });
  return missing ? null : out;
}

export interface DraftText {
  text: string;
  /** Placeholders in the link template that had no value on this entry. */
  linkSkipped: boolean;
}

/**
 * The post text for one entry: its title, a short excerpt (an excerpt-like field, else the start of the first long
 * text field), and the public link when a link template is set. Private fields are never used.
 */
export function entryToText(entry: Entry, attrs: Attributes, linkTemplate = ''): DraftText {
  const titleKey = findField(attrs, TITLE_NAMES, isPlain) ?? Object.keys(attrs).find((k) => attrs[k]?.type === 'string' && !attrs[k]?.private && fieldText(entry, k, attrs[k])) ?? null;
  const title = titleKey ? shorten(fieldText(entry, titleKey, attrs[titleKey]), 200) : '';

  let excerptKey = findField(attrs, EXCERPT_NAMES, (a) => isPlain(a) || isLong(a));
  if (excerptKey === titleKey || (excerptKey && !fieldText(entry, excerptKey, attrs[excerptKey]))) excerptKey = null;
  if (!excerptKey) excerptKey = Object.keys(attrs).find((k) => k !== titleKey && isLong(attrs[k]) && fieldText(entry, k, attrs[k])) ?? null;
  const excerpt = excerptKey ? shorten(fieldText(entry, excerptKey, attrs[excerptKey])) : '';

  const link = fillTemplate(linkTemplate, entry);
  const text = [title, excerpt, link].filter(Boolean).join('\n\n');
  return { text, linkSkipped: !!linkTemplate.trim() && !link };
}

export interface Workspace {
  id: string;
  name: string;
}

const authHeaders = (apiKey: string) => ({ Authorization: `Bearer ${apiKey.trim()}`, Accept: 'application/json' });

function statusError(status: number, json: unknown): SolMarrowError {
  if (status === 401) return new SolMarrowError('SolMarrow did not accept the API key. Check it in Settings → SolMarrow.', 400);
  if (status === 403 || status === 404) return new SolMarrowError('SolMarrow could not find the workspace for this key. Create a new key in SolMarrow.', 400);
  if (status === 429) return new SolMarrowError('SolMarrow says too many requests. Wait a minute and try again.', 429);
  const msg = pick(json, 'error', 'message') || pick(json, 'message');
  return new SolMarrowError(`SolMarrow said (${status}): ${msg || 'no details'}`, 502);
}

/** The workspace an API key belongs to (a key is made for exactly one workspace). */
export async function keyWorkspace(request: Requester, apiKey: string): Promise<Workspace> {
  if (!isApiKey(apiKey)) throw new SolMarrowError('That is not a SolMarrow API key. It starts with smk_.');
  const res = await request({ url: `${API_URL}/workspaces`, method: 'GET', headers: authHeaders(apiKey) });
  if (res.status < 200 || res.status >= 300) throw statusError(res.status, res.json);
  const list = typeof res.json === 'object' && res.json !== null ? (res.json as Record<string, unknown>).workspaces : null;
  const first = Array.isArray(list) ? list[0] : null;
  const id = pick(first, 'id');
  if (!id) throw new SolMarrowError('SolMarrow did not return a workspace for this key.', 502);
  return { id, name: pick(first, 'name') || 'Workspace' };
}

export interface DraftResult {
  postId: string;
  calendarUrl: string;
}

/** Saves one draft (no accounts, nothing scheduled or published). */
export async function createDraft(request: Requester, apiKey: string, workspaceId: string, text: string, idempotencyKey: string): Promise<DraftResult> {
  if (!isApiKey(apiKey)) throw new SolMarrowError('Add your SolMarrow API key in Settings → SolMarrow first.');
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) throw new SolMarrowError('Save your SolMarrow API key again in Settings → SolMarrow.');
  if (!text.trim()) throw new SolMarrowError('This entry has no text to send. Fill in a title or text field and save it first.');
  const res = await request({
    url: `${API_URL}/workspaces/${workspaceId}/posts`,
    method: 'POST',
    headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey.slice(0, 200) },
    body: JSON.stringify({ text, account_ids: [], media_ids: [], draft: true }),
  });
  if (res.status < 200 || res.status >= 300) throw statusError(res.status, res.json);
  const postId = pick(res.json, 'post_id') || pick(res.json, 'id');
  if (!postId) throw new SolMarrowError('SolMarrow saved the draft but did not return its ID.', 502);
  const url = pick(res.json, 'calendar_url');
  return { postId, calendarUrl: url && url.startsWith(APP_URL) ? url : `${APP_URL}/calendar` };
}
