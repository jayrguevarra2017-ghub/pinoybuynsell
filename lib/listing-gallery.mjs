export const maxListingPhotos = 8;
export const listingPhotoPathPattern = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

export function listingPhotoPaths(product) {
  return [...new Set([product?.image_path, ...(Array.isArray(product?.image_paths) ? product.image_paths : [])])]
    .filter(path => typeof path === "string" && listingPhotoPathPattern.test(path)).slice(0, maxListingPhotos);
}

export function missingGalleryColumn(error) {
  return ["42703", "PGRST204"].includes(error?.code) && /image_paths/.test(error.message || "");
}
