export const photoTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const maxPhotoSize = 5 * 1024 * 1024;
const heifTypes = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];

export function validatePhoto(file) {
  if (!file) return "";
  if (!photoTypes[file.type] && !heifTypes.includes(file.type) &&
      !((!file.type || file.type === "application/octet-stream") && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || ""))) {
    return "Choose a JPEG, PNG, WebP, HEIC, or HEIF photo.";
  }
  if (file.size <= 0 || file.size > maxPhotoSize) return "Choose a photo up to 5 MB.";
  return "";
}

// Inspect the bytes: phones and renamed files can report a misleading MIME type.
export function photoFormat(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  const text = new TextDecoder().decode(bytes);
  if (text.slice(0, 4) === "RIFF" && text.slice(8, 12) === "WEBP") return "image/webp";
  if (text.slice(4, 8) === "ftyp" && /heic|heix|hevc|hevx|mif1|msf1/.test(text.slice(8))) return "image/heif";
  return null;
}

async function convertHeif(file) {
  // Download the decoder only when needed. Conversion runs in a browser worker;
  // no image is sent to an outside conversion service.
  const { heicTo } = await import("heic-to/next");
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.85 });
}

async function fitJpeg(blob) {
  if (blob.size <= maxPhotoSize) return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55]) {
      const result = await canvas.convertToBlob({ type: "image/jpeg", quality });
      if (result.size <= maxPhotoSize) return result;
    }
    throw Error("The converted photo is too large. Choose a smaller photo.");
  } finally { bitmap.close(); }
}

export async function prepareListingPhoto(file, { convert = convertHeif, fit = fitJpeg } = {}) {
  if (!file) return null;
  const error = validatePhoto(file);
  if (error) throw Error(error);
  const format = photoFormat(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
  if (!format) throw Error("This file is not a readable photo. Choose a JPEG, PNG, WebP, HEIC, or HEIF image.");
  let output = file, type = format;
  if (format === "image/heif") {
    try { output = await fit(await convert(file)); }
    catch { throw Error("This HEIC/HEIF photo could not be converted. Try another photo or export it as JPEG."); }
    type = "image/jpeg";
    if (photoFormat(new Uint8Array(await output.slice(0, 64).arrayBuffer())) !== type) {
      throw Error("Photo conversion failed. Choose another photo or export it as JPEG.");
    }
  }
  if (output.size <= 0 || output.size > maxPhotoSize) throw Error("Choose a photo up to 5 MB after conversion.");
  const extension = photoTypes[type];
  if (output === file && file.type === type && new RegExp(`\\.${extension === "jpg" ? "jpe?g" : extension}$`, "i").test(file.name)) return file;
  return new File([output], `${file.name.replace(/\.[^.]*$/, "") || "listing-photo"}.${extension}`, { type });
}
