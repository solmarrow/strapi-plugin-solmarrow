import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_URL,
  HttpRequest,
  blocksToText,
  createDraft,
  entryToText,
  fillTemplate,
  isApiKey,
  keyPreview,
  keyWorkspace,
  linkTemplateProblem,
  markupToText,
  shorten,
} from '../server/src/lib.ts';

const KEY = 'smk_abcdefghijklmnopqrstuvwxyz012345';
const WS = '11111111-2222-3333-4444-555555555555';

test('api key format and preview', () => {
  assert.equal(isApiKey(KEY), true);
  assert.equal(isApiKey('abc'), false);
  assert.equal(isApiKey('smk_short'), false);
  assert.equal(keyPreview(KEY), 'smk_…2345');
});

test('link template rules', () => {
  assert.equal(linkTemplateProblem(''), null);
  assert.equal(linkTemplateProblem('https://example.com/blog/{slug}'), null);
  assert.match(linkTemplateProblem('http://example.com/{slug}')!, /https/);
  assert.match(linkTemplateProblem('https://example.com/{sl ug}')!, /spaces/);
  assert.match(linkTemplateProblem('https://example.com/{1bad}')!, /Placeholders/);
  assert.equal(fillTemplate('https://example.com/blog/{slug}', { slug: 'hello world' }), 'https://example.com/blog/hello%20world');
  assert.equal(fillTemplate('https://example.com/blog/{slug}', { slug: '' }), null);
});

test('blocks and markup to text', () => {
  const blocks = [
    { type: 'heading', level: 2, children: [{ type: 'text', text: 'Intro' }] },
    { type: 'paragraph', children: [{ type: 'text', text: 'Hello ' }, { type: 'link', url: 'https://x.y', children: [{ type: 'text', text: 'world' }] }] },
    { type: 'list', format: 'unordered', children: [{ type: 'list-item', children: [{ type: 'text', text: 'one' }] }] },
    { type: 'image', image: { url: '/a.png' } },
  ];
  assert.equal(blocksToText(blocks), 'Intro\n\nHello world\n\n- one');
  assert.equal(markupToText('## Title\n\nSome **bold** and [a link](https://x.y).'), 'Title\n\nSome bold and a link.');
  assert.equal(markupToText('<p>Hi &amp; bye</p><script>x()</script>'), 'Hi & bye');
});

test('shorten cuts at a word boundary', () => {
  assert.equal(shorten('short text'), 'short text');
  const long = 'word '.repeat(100);
  const s = shorten(long, 50);
  assert.ok(s.length <= 50 && s.endsWith('…') && !s.includes('wor…'));
});

test('entryToText: title, excerpt field, link; private fields ignored', () => {
  const attrs = {
    title: { type: 'string' },
    slug: { type: 'uid' },
    excerpt: { type: 'text' },
    body: { type: 'blocks' },
    secret: { type: 'text', private: true },
  };
  const entry = { title: 'Launch day', slug: 'launch-day', excerpt: 'We shipped it.', body: [], secret: 'do not share' };
  const r = entryToText(entry, attrs, 'https://example.com/blog/{slug}');
  assert.equal(r.text, 'Launch day\n\nWe shipped it.\n\nhttps://example.com/blog/launch-day');
  assert.equal(r.linkSkipped, false);
  assert.ok(!r.text.includes('do not share'));
});

test('entryToText: falls back to the first long field and reports a skipped link', () => {
  const attrs = { name: { type: 'string' }, content: { type: 'richtext' } };
  const r = entryToText({ name: 'Recipe', content: '# Step one\nMix **well**.' }, attrs, 'https://example.com/{slug}');
  assert.equal(r.text, 'Recipe\n\nStep one Mix well.');
  assert.equal(r.linkSkipped, true);
});

test('keyWorkspace and createDraft send the right requests', async () => {
  const seen: HttpRequest[] = [];
  const request = async (req: HttpRequest) => {
    seen.push(req);
    if (req.method === 'GET') return { status: 200, json: { workspaces: [{ id: WS, name: 'Main' }] } };
    return { status: 201, json: { post_id: 'p1', calendar_url: 'https://app.solmarrow.com/calendar?post=p1' } };
  };
  assert.deepEqual(await keyWorkspace(request, KEY), { id: WS, name: 'Main' });
  const r = await createDraft(request, KEY, WS, 'Hello', 'strapi:x');
  assert.deepEqual(r, { postId: 'p1', calendarUrl: 'https://app.solmarrow.com/calendar?post=p1' });
  assert.equal(seen[0].url, `${API_URL}/workspaces`);
  assert.equal(seen[1].url, `${API_URL}/workspaces/${WS}/posts`);
  assert.equal(seen[1].headers.Authorization, `Bearer ${KEY}`);
  assert.equal(seen[1].headers['Idempotency-Key'], 'strapi:x');
  assert.deepEqual(JSON.parse(seen[1].body!), { text: 'Hello', account_ids: [], media_ids: [], draft: true });
});

test('errors are plain messages', async () => {
  const say = (status: number, json: unknown = null) => async () => ({ status, json });
  await assert.rejects(keyWorkspace(say(401), KEY), /did not accept the API key/);
  await assert.rejects(createDraft(say(404), KEY, WS, 'x', 'k'), /could not find the workspace/);
  await assert.rejects(createDraft(say(500, { error: { message: 'boom' } }), KEY, WS, 'x', 'k'), /\(500\): boom/);
  await assert.rejects(createDraft(say(201), KEY, WS, '  ', 'k'), /no text/);
  await assert.rejects(createDraft(say(201, { post_id: 'p' }), 'bad', WS, 'x', 'k'), /API key/);
  // a calendar link that is not SolMarrow's is replaced
  const r = await createDraft(async () => ({ status: 201, json: { post_id: 'p', calendar_url: 'https://evil.example/x' } }), KEY, WS, 'x', 'k');
  assert.equal(r.calendarUrl, 'https://app.solmarrow.com/calendar');
});
