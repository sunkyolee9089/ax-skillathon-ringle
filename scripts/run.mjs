import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MailchimpClient } from './mailchimp-campaign.mjs';
import { prepareCampaign } from './workflow.mjs';

const localKeyFile = fileURLToPath(new URL('../.mailchimp-api-key', import.meta.url));

export function readLocalApiKey(read = readFileSync) {
  try {
    const apiKey = read(localKeyFile, 'utf8').trim();
    if (apiKey) return apiKey;
  } catch {
    // Convert a missing or unreadable local file into one safe message.
  }
  throw new Error('No Mailchimp API key is configured.');
}

export async function run(args, dependencies = {}) {
  const [command, firstArgument, secondArgument] = args;
  const env = dependencies.env ?? process.env;
  const read = dependencies.readFile ?? readFile;
  const getApiKey = dependencies.getApiKey ?? readLocalApiKey;
  const createClient = dependencies.createClient ?? ((apiKey) => new MailchimpClient(apiKey));
  const write = dependencies.write ?? ((value) => process.stdout.write(`${value}\n`));

  const apiKey = env.MAILCHIMP_API_KEY || getApiKey();
  if (!apiKey) {
    throw new Error('No Mailchimp API key is configured.');
  }

  const client = createClient(apiKey);
  let result;
  if (command === 'prepare' && firstArgument) {
    const input = JSON.parse(await read(firstArgument, 'utf8'));
    result = await prepareCampaign(client, input);
  } else if (command === 'audiences') {
    result = await client.listAudiences();
  } else if (command === 'set-audience' && firstArgument && secondArgument) {
    const campaign = await client.setAudience(firstArgument, secondArgument);
    if (campaign.status !== 'save') {
      throw new Error('Mailchimp did not keep the campaign as a saved draft.');
    }
    result = { campaign_id: campaign.id, status: 'ready_for_manual_review' };
  } else {
    throw new Error('Usage: node run.mjs <prepare <newsletter-input.json>|audiences|set-audience <campaign-id> <audience-id>>');
  }
  write(JSON.stringify(result));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
