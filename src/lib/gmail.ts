function base64url(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Sends an email using the Google Gmail REST API with the active user's OAuth token.
 */
export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<boolean> {
  const emailContent = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    bodyHtml
  ].join("\r\n");

  const raw = base64url(emailContent);

  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Gmail send error details:", errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error calling Gmail API:", error);
    return false;
  }
}
