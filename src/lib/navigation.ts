import type { Role } from "./types";

export function homeForRole(role: Role): string {
  return role === "admin" ? "/admin/overview" : `/${role}/dashboard`;
}

export function canAccessRole(actual: Role, required: Role): boolean {
  return actual === required || (actual === "admin" && required === "teacher");
}

export function loginDestination(role: Role, requested: string | null): string {
  if (!requested || !requested.startsWith("/") || requested.startsWith("//") || /[\\\x00-\x20]/.test(requested)) return homeForRole(role);
  const rawPath = requested.split(/[?#]/)[0];
  const pathname = new URL(requested, "https://meister.invalid").pathname;
  if (pathname !== rawPath || /%/i.test(pathname)) return homeForRole(role);
  if (pathname === "/profile" || [role, ...(role === "admin" ? ["teacher"] : [])].some(
    (prefix) => pathname.startsWith(`/${prefix}/`)
  )) return requested;
  return homeForRole(role);
}
