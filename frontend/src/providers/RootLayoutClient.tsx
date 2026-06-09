'use client';

import React, { useState, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { queryClient } from '@/shared/lib/react-query';
import { ToastProvider } from '@/shared/components/Toast';
import { useMediaQuery } from '@/shared/hooks';
import Navbar from '@/shared/components/Navbar';
import Footer from '@/shared/components/Footer';
import { useSession } from '@/features/auth/hooks/useSession';
import { usePendingRevisions } from '@/features/revision/hooks/usePendingRevisions';
import { useCurrentGoalProgress } from '@/features/goal/hooks/useCurrentGoalProgress';
import { AddProgressModal } from '@/features/progress/components/AddProgressModal';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { isPublicPath } from '@/shared/lib/publicPaths';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { user } = useSession();
  const isDesktop = useMediaQuery('(min-width: 940px)');
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Wait for pathname to be available
  useLayoutEffect(() => {
    if (pathname) {
      setIsReady(true);
    }
  }, [pathname]);

  // Enable user‑specific hooks only on private pages or when user is logged in
  const shouldEnableUserHooks = isReady && pathname
    ? (!isPublicPath(pathname) || !!user)
    : false;

  const { pendingCount } = usePendingRevisions({ enabled: shouldEnableUserHooks });
  const { daily } = useCurrentGoalProgress({ enabled: shouldEnableUserHooks });
  const dailyGoalProgress = {
    completed: daily?.completed ?? 0,
    target: daily?.target ?? 3,
  };

  if (!isReady || !pathname) {
    return null;
  }

  // ✅ Always show navbar and footer, regardless of authentication or path
  const shouldShowNavbar = true;
  const shouldShowFooter = isDesktop;

  return (
    <>
      {shouldShowNavbar && (
        <Navbar
          pendingRevisionsCount={pendingCount}
          dailyGoalProgress={dailyGoalProgress}
          streakCount={user?.streak?.current || 0}
        />
      )}
      <main
        className="devRhythmContainer"
        style={isMobile ? { paddingBottom: '90px' } : undefined}
      >
        {children}
      </main>
      {shouldShowFooter && <Footer />}
      <AddProgressModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </>
  );
}

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ToastProvider position="top-center">
          <LayoutContent>{children}</LayoutContent>
          <Analytics />
          <SpeedInsights />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}