export function appPlatform(navigatorLike) {
  const userAgent = navigatorLike?.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && navigatorLike?.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

export function installedDisplay(windowLike, navigatorLike) {
  return Boolean(navigatorLike?.standalone || windowLike?.matchMedia?.("(display-mode: standalone)").matches);
}

export function mobileLinkActive(pathname, href) {
  if (href === "/") return pathname === "/";
  if (href === "/account" && ["/login", "/verify", "/reset-password"].includes(pathname)) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
