export const photoTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const maxPhotoSize = 5 * 1024 * 1024;

export function validatePhoto(file) {
  if (!file) return "";
  if (!photoTypes[file.type]) return "Choose a JPEG, PNG, or WebP photo.";
  if (file.size <= 0 || file.size > maxPhotoSize) return "Choose a photo up to 5 MB.";
  return "";
}

export async function createListing(client, userId, values, photo) {
  const validation = validatePhoto(photo);
  if (validation) throw new Error(validation);
  let path = null;
  const bucket = client.storage.from("listing-photos");
  if (photo) {
    path = `${userId}/${crypto.randomUUID()}.${photoTypes[photo.type]}`;
    const { error } = await bucket.upload(path, photo, { contentType: photo.type, upsert: false });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
  }
  const { data, error } = await client.from("products")
    .insert({ ...values, seller_id: userId, ...(path ? { image_path: path } : {}) })
    .select().single();
  if (error) {
    // Clean up only after an explicit rejected insert; a network exception can
    // have an unknown outcome and must not delete a saved listing's photo.
    if (path) await bucket.remove([path]).catch(() => {});
    throw new Error(`Listing could not be saved: ${error.message}`);
  }
  return data;
}

export async function updateListing(client, userId, listingId, values, photo) {
  const validation = validatePhoto(photo);
  if (validation) throw new Error(validation);
  const bucket = client.storage.from("listing-photos");
  let path = null;
  if (photo) {
    path = `${userId}/${crypto.randomUUID()}.${photoTypes[photo.type]}`;
    const { error } = await bucket.upload(path, photo, { contentType: photo.type, upsert: false });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
  }
  const { data, error } = await client.from("products")
    .update({ ...values, ...(path ? { image_path: path } : {}) })
    .eq("id", listingId).eq("seller_id", userId).select().single();
  if (error) {
    if (path) await bucket.remove([path]).catch(() => {});
    throw new Error(`Listing could not be updated: ${error.message}`);
  }
  // Retain the old photo: another listing may reference it, and deleting it
  // could race with another edit. New uploads use unique immutable paths.
  return data;
}
