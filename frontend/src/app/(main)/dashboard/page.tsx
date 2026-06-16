import { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/features/auth/server/getCurrentUser';
import DashboardPageClient from './DashboardPageClient';
import type { DashboardResponse } from '@/features/dashboard/types/dashboard.types';

export const dynamic = 'force-dynamic';

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

/**
 * Fetch dashboard data on the server using the auth token from cookies.
 * Uses stale-while-revalidate caching strategy.
 */
async function fetchDashboardData(token: string): Promise<DashboardResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    console.error('NEXT_PUBLIC_API_BASE_URL is not defined');
    return null;
  }

  try {
    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'stale-while-revalidate=30, stale-if-error=60',
      },
      next: {
        revalidate: 30, // 30 seconds cache on the server
        tags: ['dashboard'], // For manual revalidation if needed
      },
    });

    if (!res.ok) {
      console.error(`Dashboard fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const json = await res.json();
    return json.data as DashboardResponse;
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return null;
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    const { redirect } = await import('next/navigation');
    redirect('/login');
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  let initialData: DashboardResponse | null = null;
  if (token) {
    initialData = await fetchDashboardData(token);
  }

  return <DashboardPageClient initialData={initialData} />;
}