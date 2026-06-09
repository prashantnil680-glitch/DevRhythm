import { Metadata, Viewport } from 'next';
import { getCurrentUser } from '@/features/auth/server/getCurrentUser';
import DashboardPageClient from './DashboardPageClient';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  const displayName = user?.displayName || user?.username || 'Developer';

  return {
    title: `${displayName} · Dashboard | DevRhythm`,
    description: `Track your coding progress, manage goals, view revision schedules, and monitor your productivity.`,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export { default } from './DashboardPageClient';