import { NextRequest } from "next/server";

const COOKIE = "crawler_admin";

export function sessionCookieName(): string {
  return COOKIE;
}

export function isValidSessionCookie(value: string | undefined): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || !value) return false;
  return value === secret;
}

export function verifyBrowserAuth(request: NextRequest): boolean {
  const c = request.cookies.get(COOKIE)?.value;
  return isValidSessionCookie(c);
}

export function verifyBearer(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const token = m[1];
  const cron = process.env.CRON_SECRET || process.env.ADMIN_SECRET;
  return !!cron && token === cron;
}

/** ブラウザ Cookie または Bearer（スクレイピング・取り込み API 用） */
export function verifyAdminOrBearer(request: NextRequest): boolean {
  return verifyBrowserAuth(request) || verifyBearer(request);
}
