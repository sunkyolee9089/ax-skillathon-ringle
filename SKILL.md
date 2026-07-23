---
name: mailchimp-campaign-prep
description: Prepare an unsent Mailchimp campaign from finished newsletter HTML. Use when a user says "뉴스레터 발송 준비", asks to create a Mailchimp draft, apply campaign metadata and HTML, select the final audience, or receive a Mailchimp edit link for manual review. Never use this skill to send or schedule an email campaign.
---

Use the existing Mailchimp Marketing API only through `scripts/run.mjs`. Read the local API key only through the bundled runner. Never ask the user to paste an API key into chat or include it in output.

1. Obtain the finished newsletter HTML, subject line, preview text if present, sender name, and reply-to address.
2. Before creating the draft, ask the user to confirm the planned send date. Do not infer or use today's date without confirmation.
3. Create the campaign title as `YYMMDD <content summary>` using the confirmed date. Derive the content summary from the newsletter subject or its main topics; use a user-supplied wording exactly when provided. For example: `260721 승훈님 웨비나 홍보 + 민산님 웨비나 리마인더`.
4. Create a JSON input file containing `html` and `settings`. The settings must include the generated `title`, `subject_line`, `from_name`, and `reply_to`; include `preview_text` when supplied.
5. Run `node scripts/run.mjs prepare <input-file>`. This creates a regular Mailchimp draft and uploads the HTML without selecting an audience.
6. Present the returned campaign link and ask the user whether to choose the final audience now. Do not offer sending or scheduling.
7. When the user confirms, run `node scripts/run.mjs audiences`. Display each audience's name and member count, then ask the user to choose one.
8. Run `node scripts/run.mjs set-audience <campaign-id> <audience-id>` only after the user selects an audience. Return the edit link and state that the campaign remains an unsent draft for manual review and sending in Mailchimp.

If the API returns an error after a draft is created, report the error and preserve the draft ID and edit link. Do not retry by creating another campaign unless the user requests it.
