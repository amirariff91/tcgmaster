import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export async function getAuthSession() {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    console.error('[auth] Failed to read session:', error);
    return null;
  }
}

export async function getAuthUser() {
  const session = await getAuthSession();
  return session?.user ?? null;
}
