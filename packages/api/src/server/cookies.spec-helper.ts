import { type CookieJar } from 'tough-cookie';

export const storeResponseCookies = async (
  jar: CookieJar,
  response: Response,
  url: string,
): Promise<void> => {
  await Promise.all(response.headers.getSetCookie().map((cookie) => jar.setCookie(cookie, url)));
};

export const cookieHeaders = async (
  jar: CookieJar,
  url: string,
): Promise<Readonly<Record<string, string>>> => ({ cookie: await jar.getCookieString(url) });
