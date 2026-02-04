import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from './settings-client';

export const metadata: Metadata = {
  title: 'Settings | TCGMaster',
  description: 'Manage your TCGMaster account settings and preferences.',
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login?redirect=/settings');
  }

  return <SettingsClient user={user} />;
}
