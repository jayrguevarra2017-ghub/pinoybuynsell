export const sellingComingSoon = "Selling and listing posts are coming soon for members. Only administrators can sell or post listings for now.";

export async function readSellingAccess(client, timeoutMs = 8000) {
  let timer;
  try {
    const result = await Promise.race([
      client.rpc("is_marketplace_admin"),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error("Access check timed out")), timeoutMs); })
    ]);
    if (result?.error || typeof result?.data !== "boolean") throw Error("Invalid access response");
    return result.data;
  } catch {
    throw Error("Could not confirm administrator access. Please try again.");
  } finally { clearTimeout(timer); }
}

export async function requireSellingAccess(client) {
  if (!await readSellingAccess(client)) throw Error(sellingComingSoon);
}
