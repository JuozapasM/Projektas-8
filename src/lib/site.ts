import { headers } from 'next/headers';

export async function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid site URL');
    return url.origin;
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || 'localhost:3000';
  return `${host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'}://${host}`;
}
