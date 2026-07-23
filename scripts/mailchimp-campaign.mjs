const apiPath = '/3.0';

export class MailchimpClient {
  constructor(apiKey, request = fetch) {
    const separator = apiKey.lastIndexOf('-');
    const server = apiKey.slice(separator + 1);
    if (separator < 1 || !server) {
      throw new Error('MAILCHIMP_API_KEY must include its Mailchimp server suffix.');
    }
    this.apiKey = apiKey;
    this.baseUrl = `https://${server}.api.mailchimp.com${apiPath}`;
    this.webUrl = `https://${server}.admin.mailchimp.com`;
    this.request = request;
  }

  async createDraft(settings) {
    return this.#request('/campaigns', 'POST', {
      type: 'regular',
      settings,
    });
  }

  async setContent(campaignId, html) {
    if (!html.trim()) {
      throw new Error('Newsletter HTML cannot be blank.');
    }
    return this.#request(`/campaigns/${campaignId}/content`, 'PUT', { html });
  }

  async listAudiences() {
    const response = await this.#request('/lists', 'GET');
    return response.lists.map(({ id, name, stats }) => ({
      id,
      name,
      member_count: stats.member_count,
    }));
  }

  async setAudience(campaignId, listId) {
    return this.#request(`/campaigns/${campaignId}`, 'PATCH', {
      recipients: { list_id: listId },
    });
  }

  async #request(path, method, body) {
    const response = await this.request(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${this.apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || `Mailchimp request failed (${response.status}).`);
    }
    return data;
  }
}
