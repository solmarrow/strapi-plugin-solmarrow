import type { Core } from '@strapi/strapi';

/** Two admin permissions: who may change the SolMarrow key, and who may send entries as drafts. */
const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  await strapi.service('admin::permission').actionProvider.registerMany([
    {
      section: 'settings',
      category: 'solmarrow',
      displayName: 'Manage the SolMarrow API key',
      uid: 'settings',
      pluginName: 'solmarrow',
    },
    {
      section: 'plugins',
      displayName: 'Send entries to SolMarrow as drafts',
      uid: 'send',
      pluginName: 'solmarrow',
    },
  ]);
};

export default bootstrap;
