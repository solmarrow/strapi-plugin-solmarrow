import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import { SendPanel } from './components/SendPanel';
import { getTranslation } from './utils/getTranslation';
import { SETTINGS_PERMISSIONS } from './api';

import type { StrapiApp } from '@strapi/strapi/admin';

const plugin: StrapiApp['appPlugins'][string] = {
  register(app) {
    app.registerPlugin({ id: PLUGIN_ID, initializer: Initializer, isReady: false, name: 'SolMarrow' });
  },

  bootstrap(app) {
    const link = {
      id: PLUGIN_ID,
      to: PLUGIN_ID,
      intlLabel: { id: getTranslation('settings.link'), defaultMessage: 'SolMarrow' },
      permissions: SETTINGS_PERMISSIONS,
      Component: () => import('./pages/Settings'),
    };
    // addSettingsLink is the current API; older Strapi 5 releases only have addSettingsLinks.
    if (typeof app.addSettingsLink === 'function') app.addSettingsLink('global', link);
    else app.addSettingsLinks('global', [link]);

    const cm = app.getPlugin('content-manager').apis as { addEditViewSidePanel?: (panels: unknown[]) => void };
    if (typeof cm.addEditViewSidePanel === 'function') cm.addEditViewSidePanel([SendPanel]);
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = (await import(`./translations/${locale}.json`)) as { default: Record<string, string> };
          return { data: Object.fromEntries(Object.entries(data).map(([k, v]) => [getTranslation(k), v])), locale };
        } catch {
          return { data: {}, locale };
        }
      }),
    );
  },
};

export default plugin;
