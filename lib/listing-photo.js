import { photoTypes, prepareListingPhoto } from "./listing-photo-format.mjs";
import { maxListingPhotos, listingPhotoPathPattern, missingGalleryColumn } from "./listing-gallery.mjs";
import { requireSellingAccess } from "./selling-access.mjs";
export { photoTypes, maxPhotoSize, validatePhoto } from "./listing-photo-format.mjs";

async function uploadPhotos(client, userId, photos) {
  if (photos == null) return { values: {}, uploaded: [] };
  const items = Array.isArray(photos) ? photos : [{ file: photos }];
  if (items.length > maxListingPhotos) throw Error(`Choose up to ${maxListingPhotos} photos.`);
  // Validate and convert every image before any storage write.
  const prepared = [];
  for (const item of items) {
    if (item.path) {
      if (!listingPhotoPathPattern.test(item.path) || !item.path.startsWith(`${userId}/`)) throw Error("This photo does not belong to your listing.");
      prepared.push({ path: item.path });
    } else if (item.file) prepared.push({ file: await prepareListingPhoto(item.file) });
    else throw Error("Choose a readable listing photo.");
  }
  const capability = await client.from("products").select("image_paths").limit(0);
  if (capability.error && !missingGalleryColumn(capability.error)) throw Error("Could not check photo settings. Please try again.");
  const galleryReady = !capability.error;
  if (!galleryReady && items.length > 1) throw Error("Multiple-photo setup is not complete yet. You can save one photo for now.");
  const bucket = client.storage.from("listing-photos"), uploaded = [], paths = [];
  try {
    for (const item of prepared) {
      if (item.path) { paths.push(item.path); continue; }
      const path = `${userId}/${crypto.randomUUID()}.${photoTypes[item.file.type]}`;
      const { error } = await bucket.upload(path, item.file, { contentType: item.file.type, upsert: false });
      if (error) throw Error(`Photo upload failed: ${error.message}`);
      uploaded.push(path); paths.push(path);
    }
  } catch (error) {
    // No product save was attempted; completed uploads can be cleaned up.
    if (uploaded.length) await bucket.remove(uploaded).catch(() => {});
    throw error;
  }
  return { values: { image_path: paths[0] ?? null, ...(galleryReady ? { image_paths: paths } : {}) }, uploaded };
}

export async function createListing(client, userId, values, photos) {
  await requireSellingAccess(client);
  const gallery = await uploadPhotos(client, userId, photos);
  const { data, error } = await client.from("products")
    .insert({ ...values, seller_id: userId, ...gallery.values }).select().single();
  if (error) {
    // Explicit rejection permits cleanup. Unknown network outcomes retain photos
    // because the database may have saved the listing before the response was lost.
    if (gallery.uploaded.length) await client.storage.from("listing-photos").remove(gallery.uploaded).catch(() => {});
    throw Error(`Listing could not be saved: ${error.message}`);
  }
  return data;
}

export async function updateListing(client, userId, listingId, values, photos) {
  await requireSellingAccess(client);
  const gallery = await uploadPhotos(client, userId, photos);
  const { data, error } = await client.from("products")
    .update({ ...values, ...gallery.values }).eq("id", listingId).eq("seller_id", userId).select().single();
  if (error) {
    if (gallery.uploaded.length) await client.storage.from("listing-photos").remove(gallery.uploaded).catch(() => {});
    throw Error(`Listing could not be updated: ${error.message}`);
  }
  return data;
}
