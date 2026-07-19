// Optional: sends a WhatsApp message to the admin's phone whenever a new
// order comes in, using Meta's official WhatsApp Cloud API.
// Does nothing (silently) unless all three env vars are set.
// Setup instructions: README.md → "Optional: WhatsApp notifications"

export async function notifyAdminOnWhatsapp(order) {
  const { WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_ADMIN_NUMBER } =
    process.env;

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_ADMIN_NUMBER) {
    return; // feature not configured — this is fine, admin dashboard still works
  }

  const text =
    `🔔 New Jimlo order #JML${order.id}\n` +
    `Category: ${order.category}\n` +
    (order.shopName ? `Shop: ${order.shopName}\n` : "") +
    `Details: ${order.requestText}\n` +
    `Customer: ${order.customerName} (${order.customerPhone})\n` +
    `Check the admin dashboard to accept/reject.`;

  try {
    await fetch(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: WHATSAPP_ADMIN_NUMBER,
          type: "text",
          text: { body: text },
        }),
      }
    );
  } catch (err) {
    // Never let a notification failure break order creation
    console.error("WhatsApp notify failed:", err);
  }
}
