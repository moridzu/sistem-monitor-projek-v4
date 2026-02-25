export function normalizePhoneMY(phone: string) {
  // Expect +60xxxxxxxxx. If user input "01..." we convert.
  const p = (phone || "").trim().replace(/\s|-/g, "");
  if (!p) return "";
  if (p.startsWith("+")) return p;
  if (p.startsWith("0")) return "+60" + p.slice(1);
  if (p.startsWith("60")) return "+" + p;
  return p; // fallback
}

export function waLink(phone: string, message: string) {
  const p = normalizePhoneMY(phone).replace("+", "");
  const text = encodeURIComponent(message);
  return `https://wa.me/${p}?text=${text}`;
}
