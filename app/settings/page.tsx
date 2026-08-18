import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { getAuthUser } from '@/lib/auth-server';
import { SettingsClient } from './settings-client';

export const metadata: Metadata = {
  title: 'Settings | TCGMaster',
  description: 'Manage your TCGMaster account settings and preferences.',
};

export default async function SettingsPage() {
  const user = await getAuthUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login?redirectTo=/settings');
  }

  return <SettingsClient user={user} />;
}
