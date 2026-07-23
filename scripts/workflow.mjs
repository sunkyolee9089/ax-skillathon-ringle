export async function prepareCampaign(client, { html, settings }) {
  if (!html?.trim()) {
    throw new Error('Newsletter HTML cannot be blank.');
  }
  const campaign = await client.createDraft(settings);
  await client.setContent(campaign.id, html);
  return {
    campaign_id: campaign.id,
    status: 'awaiting_audience',
    edit_url: `${client.webUrl}/campaigns/show/?id=${campaign.web_id}`,
  };
}
