export type PublicSettings = { connected: boolean; keyPreview: string | null; workspaceName: string | null; linkTemplate: string };
export type SendResult = { postId: string; calendarUrl: string; workspaceName: string | null; linkSkipped: boolean };

export const SETTINGS_PERMISSIONS = [{ action: 'plugin::solmarrow.settings', subject: null }];
export const SEND_PERMISSIONS = [{ action: 'plugin::solmarrow.send', subject: null }];

/** The server's plain message from a failed fetch-client call, or a fallback. */
export function errorMessage(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { error?: { message?: unknown } } } })?.response?.data?.error?.message;
  return typeof msg === 'string' && msg ? msg : fallback;
}
