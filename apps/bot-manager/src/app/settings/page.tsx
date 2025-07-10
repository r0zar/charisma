'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to settings/general
    router.replace('/settings/general');
  }, [router]);

  return null;
}