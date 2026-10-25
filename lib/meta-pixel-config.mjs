// Public ID from Meta Events Manager. Populate only after the owner supplies it.
export const websiteMetaPixelId = "";
export const websiteMetaPixelActivatedAt = "";

export function validMetaPixelId(value) {
  return typeof value === "string" && /^[1-9][0-9]{5,24}$/.test(value);
}

export function metaPixelConfiguration(env = {}) {
  const id = env.NEXT_PUBLIC_META_PIXEL_ID || websiteMetaPixelId;
  const activatedAt = env.META_PIXEL_ACTIVATED_AT || websiteMetaPixelActivatedAt;
  return { pixelId: validMetaPixelId(id) ? id : "", activatedAt: Number.isFinite(Date.parse(activatedAt)) ? activatedAt : "" };
}
