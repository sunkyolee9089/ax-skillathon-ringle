import assert from 'node:assert/strict';
import test from 'node:test';
import { MailchimpClient } from '../scripts/mailchimp-campaign.mjs';
import { prepareCampaign } from '../scripts/workflow.mjs';
import { readLocalApiKey, run } from '../scripts/run.mjs';

test('creates an audience-free regular draft', async () => {
  const requests = [];
  const client = new MailchimpClient('secret-us19', async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ id: 'campaign-1', status: 'save' }) };
  });

  const result = await client.createDraft({
    title: 'July newsletter',
    subject_line: 'Hello',
    from_name: 'Team',
    reply_to: 'hello@example.com',
  });

  assert.equal(result.status, 'save');
  assert.equal(requests[0].url, 'https://us19.api.mailchimp.com/3.0/campaigns');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    type: 'regular',
    settings: {
      title: 'July newsletter',
      subject_line: 'Hello',
      from_name: 'Team',
      reply_to: 'hello@example.com',
    },
  });
});

test('does not expose send or schedule operations', () => {
  assert.equal(typeof MailchimpClient.prototype.sendCampaign, 'undefined');
  assert.equal(typeof MailchimpClient.prototype.scheduleCampaign, 'undefined');
});

test('uploads newsletter HTML without changing recipients', async () => {
  const requests = [];
  const client = new MailchimpClient('secret-us19', async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ html: '<h1>Hello</h1>' }) };
  });

  await client.setContent('campaign-1', '<h1>Hello</h1>');

  assert.equal(requests[0].url, 'https://us19.api.mailchimp.com/3.0/campaigns/campaign-1/content');
  assert.equal(requests[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(requests[0].options.body), { html: '<h1>Hello</h1>' });
  assert.equal(requests[0].options.body.includes('recipients'), false);
});

test('lists available Mailchimp audiences for final selection', async () => {
  const client = new MailchimpClient('secret-us19', async () => ({
    ok: true,
    status: 200,
    json: async () => ({ lists: [{ id: 'audience-1', name: 'Subscribers', stats: { member_count: 42 } }], total_items: 1 }),
  }));

  assert.deepEqual(await client.listAudiences(), [{
    id: 'audience-1',
    name: 'Subscribers',
    member_count: 42,
  }]);
});

test('applies only the selected audience to a saved campaign draft', async () => {
  const requests = [];
  const client = new MailchimpClient('secret-us19', async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ id: 'campaign-1', status: 'save' }) };
  });

  const campaign = await client.setAudience('campaign-1', 'audience-1');

  assert.equal(campaign.status, 'save');
  assert.equal(requests[0].url, 'https://us19.api.mailchimp.com/3.0/campaigns/campaign-1');
  assert.equal(requests[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(requests[0].options.body), { recipients: { list_id: 'audience-1' } });
});

test('prepares a draft and HTML before audience selection', async () => {
  const calls = [];
  const client = {
    webUrl: 'https://us19.admin.mailchimp.com',
    async createDraft(settings) {
      calls.push({ name: 'createDraft', settings });
      return { id: 'campaign-1', web_id: 99, status: 'save' };
    },
    async setContent(campaignId, html) {
      calls.push({ name: 'setContent', campaignId, html });
      return { html };
    },
  };

  const result = await prepareCampaign(client, {
    html: '<h1>Hello</h1>',
    settings: {
      title: 'July newsletter',
      subject_line: 'Hello',
      from_name: 'Team',
      reply_to: 'hello@example.com',
    },
  });

  assert.deepEqual(calls.map(({ name }) => name), ['createDraft', 'setContent']);
  assert.deepEqual(result, {
    campaign_id: 'campaign-1',
    status: 'awaiting_audience',
    edit_url: 'https://us19.admin.mailchimp.com/campaigns/show/?id=99',
  });
});

test('requires an environment-managed API key before preparing a campaign', async () => {
  await assert.rejects(
    run(['prepare', 'newsletter.json'], {
      env: {},
      getApiKey: () => '',
      readFile: async () => JSON.stringify({ html: '<h1>Hello</h1>', settings: {} }),
      createClient: () => { throw new Error('must not construct a client'); },
      write: () => {},
    }),
    /No Mailchimp API key/,
  );
});

test('lists audiences through the command runner', async () => {
  const output = [];
  const result = await run(['audiences'], {
    env: { MAILCHIMP_API_KEY: 'secret-us19' },
    createClient: () => ({ listAudiences: async () => [{ id: 'audience-1', name: 'Subscribers', member_count: 42 }] }),
    write: (value) => output.push(value),
  });

  assert.deepEqual(result, [{ id: 'audience-1', name: 'Subscribers', member_count: 42 }]);
  assert.equal(output[0], JSON.stringify(result));
});

test('applies a selected audience through the command runner', async () => {
  const output = [];
  const result = await run(['set-audience', 'campaign-1', 'audience-1'], {
    env: { MAILCHIMP_API_KEY: 'secret-us19' },
    createClient: () => ({ setAudience: async () => ({ id: 'campaign-1', status: 'save' }) }),
    write: (value) => output.push(value),
  });

  assert.deepEqual(result, { campaign_id: 'campaign-1', status: 'ready_for_manual_review' });
  assert.equal(output[0], JSON.stringify(result));
});

test('reads the API key from the secure local provider when no environment key exists', async () => {
  let receivedKey;
  const result = await run(['audiences'], {
    env: {},
    getApiKey: () => 'secret-us19',
    createClient: (apiKey) => {
      receivedKey = apiKey;
      return { listAudiences: async () => [] };
    },
    write: () => {},
  });

  assert.equal(receivedKey, 'secret-us19');
  assert.deepEqual(result, []);
});

test('reads a trimmed API key from the ignored local key file', () => {
  const key = readLocalApiKey(() => 'secret-us19\n');
  assert.equal(key, 'secret-us19');
});
