export async function withDeadline(operation, milliseconds = 20000) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("The request timed out. Refresh to check its result before trying again.")), milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function openIdentityDocument(client, path) {
  const result = await withDeadline(client.storage.from("identity-documents").createSignedUrl(path, 60));
  if (result.error || !result.data?.signedUrl) throw new Error("Could not open this ID. Check that the document exists and the private Storage admin policy is installed.");
  return result.data.signedUrl;
}

export async function reviewIdentity(client, userId, decision, note) {
  const result = await withDeadline(client.rpc("review_identity", {
    p_user_id: userId, p_decision: decision, p_note: note || "",
  }));
  if (result.error) throw new Error(result.error.message || "Review failed.");
}
