const ORDER_URL = import.meta.env.VITE_ORDER_WEBHOOK_URL;
const AI_URL = import.meta.env.VITE_AI_WEBHOOK_URL;

async function post(url, body) {
  if (!url) throw new Error("Webhook URL is not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// customer = {name,email,phone}; items = [{id,name,quantity}] (no prices sent)
export const placeOrder = (customer, items) => post(ORDER_URL, { customer, items });

export const askAssistant = (message, sessionId) =>
  post(AI_URL, { message, sessionId });