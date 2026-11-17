import type { Core } from '@strapi/strapi';
import { SolMarrowError, type Attributes, type Entry } from '../lib';
import { SEND, SETTINGS } from '../routes';

type Ctx = {
  request: { body?: Record<string, unknown> };
  state: { userAbility?: unknown };
  status: number;
  body: unknown;
};

const fail = (ctx: Ctx, status: number, message: string) => {
  ctx.status = status;
  ctx.body = { data: null, error: { status, name: 'SolMarrowError', message } };
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const solmarrow = ({ strapi }: { strapi: Core.Strapi }) => {
  const service = () => strapi.plugin('solmarrow').service('solmarrow');

  const guard = async (ctx: Ctx, work: () => Promise<unknown>) => {
    try {
      ctx.body = { data: await work() };
    } catch (e) {
      if (e instanceof SolMarrowError) return fail(ctx, e.status, e.message);
      strapi.log.error(`[solmarrow] ${e instanceof Error ? e.message : String(e)}`);
      fail(ctx, 500, 'Something went wrong while talking to SolMarrow.');
    }
  };

  return {
    getSettings(ctx: Ctx) {
      const ability = ctx.state.userAbility as { can?: (action: string) => boolean } | undefined;
      if (!ability?.can?.(SETTINGS) && !ability?.can?.(SEND)) return fail(ctx, 403, 'You are not allowed to use SolMarrow.');
      return guard(ctx, () => service().getSettings());
    },
    saveSettings: (ctx: Ctx) => guard(ctx, () => service().saveSettings(ctx.request.body ?? {})),
    removeKey: (ctx: Ctx) => guard(ctx, () => service().removeKey()),

    /** POST /solmarrow/send { model, documentId, locale?, status? } */
    async send(ctx: Ctx) {
      const body = ctx.request.body ?? {};
      const model = str(body.model);
      const documentId = str(body.documentId);
      const locale = str(body.locale) || undefined;
      const status = body.status === 'published' ? 'published' : 'draft';
      // Only the project's own content types, never users, admin or plugin internals.
      const contentType = model.startsWith('api::') ? (strapi.contentTypes as unknown as Record<string, { attributes?: Attributes }>)[model] : undefined;
      if (!contentType || !documentId || documentId.length > 64) return fail(ctx, 400, 'Save the entry first, then send it.');

      // The same read rules as the Content Manager: the admin must be allowed to read this entry and its fields.
      const checker = strapi.plugin('content-manager').service('permission-checker').create({ userAbility: ctx.state.userAbility, model });
      if (checker.cannot.read()) return fail(ctx, 403, 'You are not allowed to read this content type.');
      const doc = (await strapi.documents(model as never).findOne({ documentId, locale, status } as never)) as Entry | null;
      if (!doc) return fail(ctx, 404, 'Entry not found. Save it first, then send it.');
      if (checker.cannot.read(doc)) return fail(ctx, 403, 'You are not allowed to read this entry.');
      const visible = (await checker.sanitizeOutput(doc)) as Entry;

      await guard(ctx, () => service().send(visible, contentType.attributes ?? {}, `${model}:${documentId}`));
    },
  };
};

export default { solmarrow };
