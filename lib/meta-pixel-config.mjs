// Owner-supplied public Pixel ID from Meta Events Manager.
export const websiteMetaPixelId = "2995495604126695";
export const websiteMetaPixelActivatedAt = "2026-10-25T00:55:00Z";

export function validMetaPixelId(value) {
  return typeof value === "string" && /^[1-9][0-9]{5,24}$/.test(value);
}

export function metaPixelConfiguration(env = {}) {
  const id = env.NEXT_PUBLIC_META_PIXEL_ID || websiteMetaPixelId;
  const activatedAt = env.META_PIXEL_ACTIVATED_AT || websiteMetaPixelActivatedAt;
  return { pixelId: validMetaPixelId(id) ? id : "", activatedAt: Number.isFinite(Date.parse(activatedAt)) ? activatedAt : "" };
}
