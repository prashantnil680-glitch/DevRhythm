import { Metadata, Viewport } from 'next';
import { NotificationsPageContent } from './parts/NotificationsPageContent';

export const metadata: Metadata = {
  title: 'Notifications - DevRhythm',
  description: 'View and manage your notifications',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function NotificationsPage() {
  return <NotificationsPageContent />;
}