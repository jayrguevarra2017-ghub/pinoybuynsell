import test from "node:test";
import assert from "node:assert/strict";
import { maxPhotoSize, photoFormat, prepareListingPhoto, validatePhoto } from "../lib/listing-photo-format.mjs";

const jpeg = new Uint8Array([255, 216, 255, 224, 0, 10]);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const heif = new Uint8Array([0, 0, 0, 28, ...new TextEncoder().encode("ftypheic\0\0\0\0mif1heix")]);
const file = (bytes, name = "photo.jpg", type = "image/jpeg") => new File([bytes], name, { type });

test("photo detection inspects image contents instead of a phone's filename or MIME type", () => {
  assert.equal(photoFormat(jpeg), "image/jpeg");
  assert.equal(photoFormat(png), "image/png");
  assert.equal(photoFormat(new TextEncoder().encode("RIFF1234WEBP")), "image/webp");
  assert.equal(photoFormat(heif), "image/heif");
  for (const bytes of [new Uint8Array(), new TextEncoder().encode("<svg></svg>"), new TextEncoder().encode("not a photo")]) assert.equal(photoFormat(bytes), null);
});

test("HEIC/HEIF metadata is accepted while input size and unsupported types remain restricted", () => {
  assert.equal(validatePhoto(file(heif, "phone.heic", "image/heic")), "");
  assert.equal(validatePhoto(file(heif, "phone.heif", "")), "");
  assert.match(validatePhoto(file(png, "photo.svg", "image/svg+xml")), /Choose/);
  assert.match(validatePhoto(file([], "empty.jpg")), /5 MB/);
  assert.match(validatePhoto({ type: "image/heic", size: maxPhotoSize + 1 }), /5 MB/);
});

test("a HEIC disguised as JPG is converted to a real JPEG before saving", async () => {
  const original = file(heif, "camera.JPG", "image/jpeg"); let calls = 0;
  const prepared = await prepareListingPhoto(original, { convert: async input => { assert.equal(input, original); calls++; return new Blob([jpeg], { type: "image/jpeg" }); } });
  assert.equal(calls, 1); assert.equal(prepared.name, "camera.jpg"); assert.equal(prepared.type, "image/jpeg");
  assert.equal(photoFormat(new Uint8Array(await prepared.arrayBuffer())), "image/jpeg");
  assert.equal(photoFormat(new Uint8Array(await original.arrayBuffer())), "image/heif");
});

test("ordinary JPEGs avoid conversion and incorrectly labeled PNGs receive matching metadata", async () => {
  const original = file(jpeg); const convert = () => { throw Error("Should not decode JPEG"); };
  assert.equal(await prepareListingPhoto(original, { convert }), original);
  const prepared = await prepareListingPhoto(file(png), { convert });
  assert.equal(prepared.name, "photo.png"); assert.equal(prepared.type, "image/png");
});

test("invalid image bytes and unsuccessful HEIC conversion cannot become saved photo files", async () => {
  await assert.rejects(prepareListingPhoto(file("<script>bad</script>")), /not a readable photo/);
  await assert.rejects(prepareListingPhoto(file(heif), { convert: async () => { throw Error("Codec failed"); } }), /could not be converted/);
  await assert.rejects(prepareListingPhoto(file(heif), { convert: async () => new Blob([heif]) }), /conversion failed/);
});

test("oversized converted images pass through compression and must meet the storage limit", async () => {
  const big = new Blob([jpeg, new Uint8Array(maxPhotoSize)]); let compressed = false;
  const prepared = await prepareListingPhoto(file(heif), { convert: async () => big, fit: async blob => { assert.equal(blob, big); compressed = true; return new Blob([jpeg]); } });
  assert.equal(compressed, true); assert(prepared.size <= maxPhotoSize);
  await assert.rejects(prepareListingPhoto(file(heif), { convert: async () => big, fit: async blob => blob }), /after conversion/);
});

test("photo-less listings remain supported", async () => {
  assert.equal(await prepareListingPhoto(null), null);
});
