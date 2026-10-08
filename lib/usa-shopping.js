export function validateUSARequest(form) {
  if (!form.contact_name?.trim() || form.contact_name.trim().length > 150) return "Enter your contact name (up to 150 characters).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email || "") || form.contact_email.length > 254) return "Enter a valid contact email.";
  if (!form.contact_phone?.trim() || form.contact_phone.length > 40) return "Enter your phone number (up to 40 characters).";
  if (!form.destination?.trim() || form.destination.length > 200) return "Enter your delivery city and province.";
  if (!form.item_name?.trim() || form.item_name.length > 200) return "Enter the item name (up to 200 characters).";
  try {
    const url = new URL(form.item_url);
    if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password || form.item_url.length > 2000) return "Enter a full HTTPS item link.";
  } catch { return "Enter a full HTTPS item link."; }
  if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 1 || Number(form.quantity) > 100) return "Enter a quantity between 1 and 100.";
  if (!form.item_details?.trim() || form.item_details.length > 3000) return "Describe the size, color, model, or other item details (up to 3,000 characters).";
  return "";
}
