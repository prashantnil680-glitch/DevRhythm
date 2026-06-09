'use client';

import NotFoundPage from '@/shared/components/NotFoundPage';

export default function NotFound() {
  return (
    <NotFoundPage
      title="Page Not Found"
      message="The page you are looking for doesn't exist or may have been moved."
      actions={[
        { text: 'Back to Home', href: '/', variant: 'primary' },
        { text: 'Browse Sheets', href: '/sheets', variant: 'outline' },
      ]}
    />
  );
}