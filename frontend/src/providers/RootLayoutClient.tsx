'use client';

import React, { useState } from 'react';
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
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { user } = useSession();
  const isDesktop = useMediaQuery('(min-width: 940px)');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const isHomepageUnauthenticated = pathname === '/' && !user;
  const shouldShowNavbar = !isHomepageUnauthenticated;
  const shouldShowFooter = isDesktop && !isHomepageUnauthenticated;

  // ✅ Only enable hooks when navbar is shown (prevents API calls on unauthenticated homepage)
  const { pendingCount } = usePendingRevisions({ enabled: shouldShowNavbar });
  const { daily } = useCurrentGoalProgress({ enabled: shouldShowNavbar });

  const dailyGoalProgress = {
    completed: daily?.completed ?? 0,
    target: daily?.target ?? 3,
  };

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