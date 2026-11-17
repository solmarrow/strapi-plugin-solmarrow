import * as React from 'react';
import { Button, Flex, Link, Typography } from '@strapi/design-system';
import { NavLink } from 'react-router-dom';
import { useFetchClient, useNotification, useRBAC } from '@strapi/strapi/admin';
import { SEND_PERMISSIONS, errorMessage, type PublicSettings, type SendResult } from '../api';

type Props = { model: string; documentId?: string; document?: { locale?: string | null }; activeTab: 'draft' | 'published' | null };

const PanelContent = ({ model, documentId, document, activeTab }: Props) => {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [settings, setSettings] = React.useState<PublicSettings | null>(null);
  const [sending, setSending] = React.useState(false);
  const [last, setLast] = React.useState<SendResult | null>(null);

  React.useEffect(() => {
    get<{ data: PublicSettings }>('/solmarrow/settings')
      .then(({ data }) => setSettings(data.data))
      .catch(() => setSettings({ connected: false, keyPreview: null, workspaceName: null, linkTemplate: '' }));
  }, [get]);

  if (!documentId) return <Typography variant="pi">Save this entry first, then send it to SolMarrow.</Typography>;
  if (settings && !settings.connected)
    return (
      <Typography variant="pi">
        Add your SolMarrow API key in <Link tag={NavLink} to="/settings/solmarrow">Settings → SolMarrow</Link> first.
      </Typography>
    );

  const send = async () => {
    setSending(true);
    try {
      const { data } = await post<{ data: SendResult }>('/solmarrow/send', { model, documentId, locale: document?.locale ?? undefined, status: activeTab === 'published' ? 'published' : 'draft' });
      setLast(data.data);
      toggleNotification({
        type: data.data.linkSkipped ? 'warning' : 'success',
        message: data.data.linkSkipped ? 'Draft saved in SolMarrow, without the link (a field in the link template is empty).' : 'Draft saved in SolMarrow.',
      });
    } catch (e) {
      toggleNotification({ type: 'danger', message: errorMessage(e, 'Could not send to SolMarrow.') });
    } finally {
      setSending(false);
    }
  };

  return (
    <Flex direction="column" alignItems="stretch" gap={2} width="100%">
      <Button variant="secondary" fullWidth loading={sending} disabled={!settings} onClick={send}>
        Send to SolMarrow
      </Button>
      <Typography variant="pi" textColor="neutral600">
        Sends the saved title and text as a draft{settings?.workspaceName ? ` to “${settings.workspaceName}”` : ''}. Nothing is posted until you schedule it in SolMarrow.
      </Typography>
      {last ? (
        <Link href={last.calendarUrl} isExternal>
          Open the draft in SolMarrow
        </Link>
      ) : null}
    </Flex>
  );
};

/**
 * Content Manager side panel (called by Strapi like a hook). Shown on the project's own (api::) content types, to
 * admins who hold the "Send entries to SolMarrow" permission.
 */
export const SendPanel = (props: Props) => {
  const { allowedActions, isLoading } = useRBAC({ send: SEND_PERMISSIONS });
  if (!props.model.startsWith('api::') || isLoading || !allowedActions.canSend) return null;
  return { title: 'SolMarrow', content: <PanelContent {...props} /> };
};
