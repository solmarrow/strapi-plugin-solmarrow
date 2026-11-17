import * as React from 'react';
import { Box, Button, Field, Flex, Link, TextInput, Typography } from '@strapi/design-system';
import { Layouts, Page, useFetchClient, useNotification } from '@strapi/strapi/admin';
import { SETTINGS_PERMISSIONS, errorMessage, type PublicSettings } from '../api';

const Settings = () => {
  const { get, put, del } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [settings, setSettings] = React.useState<PublicSettings | null>(null);
  const [apiKey, setApiKey] = React.useState('');
  const [linkTemplate, setLinkTemplate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');

  React.useEffect(() => {
    get<{ data: PublicSettings }>('/solmarrow/settings')
      .then(({ data }) => {
        setSettings(data.data);
        setLinkTemplate(data.data.linkTemplate ?? '');
      })
      .catch((e: unknown) => setLoadError(errorMessage(e, 'Could not load the SolMarrow settings.')));
  }, [get]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await put<{ data: PublicSettings }>('/solmarrow/settings', { apiKey: apiKey.trim(), linkTemplate });
      setSettings(data.data);
      setApiKey('');
      toggleNotification({ type: 'success', message: data.data.connected ? `Saved. Drafts go to “${data.data.workspaceName}”.` : 'Saved.' });
    } catch (err) {
      toggleNotification({ type: 'danger', message: errorMessage(err, 'Could not save.') });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const { data } = await del<{ data: PublicSettings }>('/solmarrow/settings/key');
      setSettings(data.data);
      toggleNotification({ type: 'info', message: 'The API key was removed from Strapi. Delete it in SolMarrow too.' });
    } catch (err) {
      toggleNotification({ type: 'danger', message: errorMessage(err, 'Could not remove the key.') });
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <Page.Error />;
  if (!settings) return <Page.Loading />;

  return (
    <Page.Main>
      <Page.Title>Settings - SolMarrow</Page.Title>
      <form onSubmit={save}>
        <Layouts.Header
          title="SolMarrow"
          subtitle="Send entries to SolMarrow as social media drafts."
          primaryAction={
            <Button type="submit" loading={saving} disabled={!apiKey.trim() && linkTemplate === settings.linkTemplate}>
              Save
            </Button>
          }
        />
        <Layouts.Content>
          <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius>
            <Flex direction="column" alignItems="stretch" gap={5}>
              <Typography variant="delta" tag="h2">
                {settings.connected ? `Connected to “${settings.workspaceName}” (${settings.keyPreview})` : 'Not connected yet'}
              </Typography>
              <Field.Root name="apiKey" hint="In SolMarrow open Settings → API keys and create a key. It starts with smk_ and is stored in this Strapi database.">
                <Field.Label>{settings.connected ? 'Replace API key' : 'API key'}</Field.Label>
                <TextInput type="password" autoComplete="off" placeholder="smk_..." value={apiKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)} />
                <Field.Hint />
              </Field.Root>
              <Field.Root name="linkTemplate" hint="Optional. Adds the public link to each draft. Use field names in braces, e.g. https://example.com/blog/{slug}">
                <Field.Label>Link template</Field.Label>
                <TextInput placeholder="https://example.com/blog/{slug}" value={linkTemplate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLinkTemplate(e.target.value)} />
                <Field.Hint />
              </Field.Root>
              <Typography variant="pi" textColor="neutral600">
                The plugin only talks to app.solmarrow.com, only when you save a key here or press “Send to SolMarrow” on an entry. Drafts never
                publish by themselves: open SolMarrow to pick accounts and schedule. No tracking.{' '}
                <Link href="https://github.com/solmarrow/strapi-plugin-solmarrow#readme" isExternal>
                  Help
                </Link>
              </Typography>
              {settings.connected ? (
                <Box>
                  <Button variant="danger-light" onClick={remove} disabled={saving}>
                    Remove API key
                  </Button>
                </Box>
              ) : null}
            </Flex>
          </Box>
        </Layouts.Content>
      </form>
    </Page.Main>
  );
};

const ProtectedSettings = () => (
  <Page.Protect permissions={SETTINGS_PERMISSIONS}>
    <Settings />
  </Page.Protect>
);

export default ProtectedSettings;
