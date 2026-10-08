import { withDeadline } from "./verification-actions";

export async function checkAdminAccess(client) {
  try {
    const result = await withDeadline(client.rpc("is_marketplace_admin"));
    return !result.error && result.data === true;
  } catch {
    return false;
  }
}
