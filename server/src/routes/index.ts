const isAdmin = 'admin::isAuthenticatedAdmin';
const can = (action: string) => ({ name: 'admin::hasPermissions', config: { actions: [action] } });
export const SETTINGS = 'plugin::solmarrow.settings';
export const SEND = 'plugin::solmarrow.send';

export default {
  admin: {
    type: 'admin',
    routes: [
      // Senders read the settings too, to know whether a key is saved (the key itself is never returned).
      // hasPermissions needs ALL listed actions, so the either-one check is in the controller.
      { method: 'GET', path: '/settings', handler: 'solmarrow.getSettings', config: { policies: [isAdmin] } },
      { method: 'PUT', path: '/settings', handler: 'solmarrow.saveSettings', config: { policies: [isAdmin, can(SETTINGS)] } },
      { method: 'DELETE', path: '/settings/key', handler: 'solmarrow.removeKey', config: { policies: [isAdmin, can(SETTINGS)] } },
      { method: 'POST', path: '/send', handler: 'solmarrow.send', config: { policies: [isAdmin, can(SEND)] } },
    ],
  },
};
