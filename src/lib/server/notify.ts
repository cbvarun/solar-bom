/**
 * Sales notification. Email delivery needs an SMTP or transactional-email
 * integration, which is not configured in this build. Requests are always
 * stored in the database (visible under Admin → Enquiries); this function
 * reports honestly whether an email was sent.
 */
export interface DeliveryResult {
  emailed: boolean;
  message: string;
}

export async function notifySales(_msg: { subject: string; text: string; attachments?: { filename: string; content: Uint8Array }[] }): Promise<DeliveryResult> {
  if (!process.env.SMTP_URL) {
    return {
      emailed: false,
      message: "Saved for the sales team. Email delivery is not configured yet (set SMTP_URL to enable it), so no email was sent.",
    };
  }
  // Integration point: send via the configured provider here.
  return { emailed: false, message: "SMTP_URL is set but the email provider integration has not been implemented yet. The request was saved." };
}
