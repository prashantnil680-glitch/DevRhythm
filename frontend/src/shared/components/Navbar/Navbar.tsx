"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiHome,
  FiTarget,
  FiUsers,
  FiUser,
  FiPlus,
  FiLogOut,
  FiSettings,
  FiShare2,
  FiBookOpen,
  FiChevronDown,
  FiTrendingUp,
  FiMenu,
  FiX,
  FiClock,
  FiGrid,
  FiChevronRight,
  FiBell,
} from 'react-icons/fi';
import { FaFire } from 'react-icons/fa';
import clsx from 'clsx';

import { ROUTES } from '@/shared/config';
import { useMediaQuery, useClickOutside } from '@/shared/hooks';
import Logo from '@/shared/components/Logo';
import { Avatar } from '@/shared/components/Avatar';
import ThemeToggle from '@/shared/components/ThemeToggle';
import Button from '@/shared/components/Button';
import { useSession } from '@/features/auth/hooks/useSession';
import { useUnreadCount } from '@/features/notification/hooks/useNotifications';

import styles from './Navbar.module.css';

export interface NavbarProps {
  pendingRevisionsCount?: number;
  dailyGoalProgress?: { completed: number; target: number };
  streakCount?: number;
  className?: string;
}

type DropdownId = 'sheets' | 'questions' | 'progress' | 'groups' | 'profile' | null;

export const Navbar: React.FC<NavbarProps> = ({
  pendingRevisionsCount = 0,
  dailyGoalProgress = { completed: 0, target: 3 },
  streakCount = 0,
  className,
}) => {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { data: unreadCountData } = useUnreadCount();
  const unreadCount = unreadCountData?.unreadCount ?? 0;

  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const sheetsRef = useRef<HTMLDivElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = useCallback((id: DropdownId) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  }, []);

  useClickOutside(sheetsRef, () => {
    if (openDropdown === 'sheets') setOpenDropdown(null);
  });
  useClickOutside(questionsRef, () => {
    if (openDropdown === 'questions') setOpenDropdown(null);
  });
  useClickOutside(progressRef, () => {
    if (openDropdown === 'progress') setOpenDropdown(null);
  });
  useClickOutside(groupsRef, () => {
    if (openDropdown === 'groups') setOpenDropdown(null);
  });
  useClickOutside(profileRef, () => {
    if (openDropdown === 'profile') setOpenDropdown(null);
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = useCallback((href: string) => pathname === href, [pathname]);

  const loginHref =
    pathname && !pathname.startsWith('/login')
      ? `/login?returnTo=${encodeURIComponent(pathname)}`
      : '/login';

  // Desktop navigation
  if (!isMobile) {
    return (
      <nav className={clsx(styles.navbar, scrolled && styles.scrolled, className)}>
        <div className={styles.desktopContainer}>
          <Logo size="sm" layout="horizontal" />

          <div className={styles.navLinks}>
            {/* Sheets dropdown (first) */}
            <div className={styles.dropdownWrapper} ref={sheetsRef}>
              <Button
                variant="ghost"
                className={clsx(styles.navLink, openDropdown === 'sheets' && styles.active)}
                onClick={() => toggleDropdown('sheets')}
                aria-expanded={openDropdown === 'sheets'}
                aria-haspopup="true"
                leftIcon={<FiGrid />}
                rightIcon={<FiChevronDown />}
              >
                Sheets
              </Button>
              {openDropdown === 'sheets' && (
                <div className={styles.dropdownMenu}>
                  <Link href={ROUTES.SHEETS.ROOT} className={styles.dropdownItem}>
                    All Sheets
                  </Link>
                  <Link href={ROUTES.SHEETS.CREATE} className={styles.dropdownItem}>
                    Create Sheet
                  </Link>
                </div>
              )}
            </div>

            {/* Questions dropdown */}
            <div className={styles.dropdownWrapper} ref={questionsRef}>
              <Button
                variant="ghost"
                className={clsx(styles.navLink, openDropdown === 'questions' && styles.active)}
                onClick={() => toggleDropdown('questions')}
                aria-expanded={openDropdown === 'questions'}
                aria-haspopup="true"
                leftIcon={<FiBookOpen />}
                rightIcon={<FiChevronDown />}
              >
                Questions
              </Button>
              {openDropdown === 'questions' && (
                <div className={styles.dropdownMenu}>
                  <Link href={ROUTES.QUESTIONS.ROOT} className={styles.dropdownItem}>
                    Browse all questions
                  </Link>
                  <Link href={ROUTES.PATTERNS.ROOT} className={styles.dropdownItem}>
                    Patterns
                  </Link>
                </div>
              )}
            </div>

            {/* Progress dropdown */}
            <div className={styles.dropdownWrapper} ref={progressRef}>
              <Button
                variant="ghost"
                className={clsx(styles.navLink, openDropdown === 'progress' && styles.active)}
                onClick={() => toggleDropdown('progress')}
                aria-expanded={openDropdown === 'progress'}
                aria-haspopup="true"
                leftIcon={<FiTrendingUp />}
                rightIcon={<FiChevronDown />}
              >
                Progress
                {pendingRevisionsCount > 0 && user && (
                  <span
                    className={styles.badge}
                    aria-label={`${pendingRevisionsCount} pending revisions`}
                  >
                    {pendingRevisionsCount > 9 ? '9+' : pendingRevisionsCount}
                  </span>
                )}
              </Button>
              {openDropdown === 'progress' && (
                <div className={styles.dropdownMenu}>
                  <Link href={ROUTES.GOALS.ROOT} className={styles.dropdownItem}>
                    Goals
                  </Link>
                  <Link href={ROUTES.REVISIONS.ROOT} className={styles.dropdownItem}>
                    Revisions
                    {pendingRevisionsCount > 0 && user && (
                      <span className={styles.badgeInline}>{pendingRevisionsCount}</span>
                    )}
                  </Link>
                </div>
              )}
            </div>

            {/* Groups dropdown */}
            <div className={styles.dropdownWrapper} ref={groupsRef}>
              <Button
                variant="ghost"
                className={clsx(styles.navLink, openDropdown === 'groups' && styles.active)}
                onClick={() => toggleDropdown('groups')}
                aria-expanded={openDropdown === 'groups'}
                aria-haspopup="true"
                leftIcon={<FiUsers />}
                rightIcon={<FiChevronDown />}
              >
                Groups
              </Button>
              {openDropdown === 'groups' && (
                <div className={styles.dropdownMenu}>
                  <Link href={ROUTES.GROUPS.MY} className={styles.dropdownItem}>
                    My Groups
                  </Link>
                  <Link href={ROUTES.GROUPS.CREATE} className={styles.dropdownItem}>
                    Create Group
                  </Link>
                </div>
              )}
            </div>

            {/* Streak pill */}
            {user && streakCount > 0 && (
              <div className={styles.streakPill} title={`${streakCount} day streak`}>
                <FaFire className={styles.streakFireIcon} />
                <span>{streakCount}</span>
              </div>
            )}

            {/* Notification icon (only for logged in users) */}
            {user && (
              <Link
                href={ROUTES.NOTIFICATIONS.ROOT}
                className={styles.notificationLink}
                aria-label="Notifications"
              >
                <FiBell className={styles.notificationIcon} />
                {unreadCount > 0 && (
                  <span className={styles.notificationBadge}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}

            <ThemeToggle variant="icon" className={styles.themeToggle} />

            {/* Profile dropdown */}
            {user ? (
              <div className={styles.dropdownWrapper} ref={profileRef}>
                <Button
                  variant="ghost"
                  className={clsx(styles.avatarButton, openDropdown === 'profile' && styles.active)}
                  onClick={() => toggleDropdown('profile')}
                  aria-expanded={openDropdown === 'profile'}
                  aria-haspopup="true"
                >
                  <Avatar
                    src={user.avatarUrl}
                    name={user.displayName || user.username}
                    size="md"
                  />
                </Button>
                {openDropdown === 'profile' && (
                  <div className={styles.dropdownMenu} style={{ right: 0, left: 'auto' }}>
                    <Link
                      href={ROUTES.USER_PROFILE.OWN(user.username)}
                      className={styles.dropdownItem}
                    >
                      <FiUser /> Profile
                    </Link>
                    {/* <Link href={ROUTES.SHARES.ROOT} className={styles.dropdownItem}>
                      <FiShare2 /> Shares
                    </Link> */}
                    <div className={styles.dropdownDivider} />
                    <button onClick={logout} className={styles.dropdownItem}>
                      <FiLogOut /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href={loginHref} className={styles.loginLink}>
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>
    );
  }

  // Mobile navigation
  return (
    <>
      <header className={clsx(styles.mobileHeader, scrolled && styles.scrolled)}>
        <Logo size="sm" layout="horizontal" />
        <Button
          variant="ghost"
          className={clsx(styles.hamburgerButton, isDrawerOpen && styles.hamburgerOpen)}
          onClick={() => setIsDrawerOpen(true)}
          aria-label="Open menu"
          leftIcon={<FiMenu />}
        />
      </header>

      {isDrawerOpen && (
        <div className={styles.drawerOverlay} onClick={() => setIsDrawerOpen(false)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              className={styles.drawerClose}
              onClick={() => setIsDrawerOpen(false)}
              aria-label="Close menu"
              leftIcon={<FiX />}
            />

            <div className={styles.drawerContent}>
              <div className={styles.drawerThemeToggle}>
                <span>Theme</span>
                <ThemeToggle variant="both" />
              </div>

                {/* Notifications section (only for logged in users) */}
                {user && (
                  <div className={styles.drawerSection}>
                    <h3>Notifications</h3>
                    <Link href={ROUTES.NOTIFICATIONS.ROOT} onClick={() => setIsDrawerOpen(false)}>
                      View Notifications
                      {unreadCount > 0 && <span className={styles.drawerBadge}>{unreadCount}</span>}
                    </Link>
                  </div>
                )}


              {user ? (
                <Link
                  href={ROUTES.USER_PROFILE.OWN(user.username)}
                  onClick={() => setIsDrawerOpen(false)}
                  className={styles.drawerUserLink}
                >
                  <div className={styles.drawerUser}>
                    <Avatar
                      src={user.avatarUrl}
                      name={user.displayName || user.username}
                      size="md"
                    />
                    <div className={styles.drawerUserInfo}>
                      <span className={styles.drawerUserName}>
                        {user.displayName || user.username}
                      </span>
                      {streakCount > 0 && (
                        <div className={styles.drawerStreak}>
                          <FaFire />
                          <span>{streakCount} day streak</span>
                        </div>
                      )}
                    </div>
                    <FiChevronRight className={styles.drawerUserChevron} />
                  </div>
                </Link>
              ) : (
                <Link
                  href={loginHref}
                  className={styles.drawerLoginLink}
                  onClick={() => setIsDrawerOpen(false)}
                >
                  Login
                </Link>
              )}

              {/* Sheets section (first) */}
              <div className={styles.drawerSection}>
                <h3>Sheets</h3>
                <Link href={ROUTES.SHEETS.ROOT} onClick={() => setIsDrawerOpen(false)}>
                  All Sheets
                </Link>
                <Link href={ROUTES.SHEETS.CREATE} onClick={() => setIsDrawerOpen(false)}>
                  Create Sheet
                </Link>
              </div>

              {/* Questions section */}
              <div className={styles.drawerSection}>
                <h3>Questions</h3>
                <Link href={ROUTES.QUESTIONS.ROOT} onClick={() => setIsDrawerOpen(false)}>
                  Browse all questions
                </Link>
                <Link href={ROUTES.PATTERNS.ROOT} onClick={() => setIsDrawerOpen(false)}>
                  Patterns
                </Link>
              </div>

              {/* Progress section */}
              <div className={styles.drawerSection}>
                <h3>Progress</h3>
                <Link href={ROUTES.GOALS.ROOT} onClick={() => setIsDrawerOpen(false)}>
                  Goals
                </Link>
                <Link href={ROUTES.REVISIONS.ROOT} onClick={() => setIsDrawerOpen(false)}>
                  Revisions
                  {pendingRevisionsCount > 0 && user && (
                    <span className={styles.drawerBadge}>{pendingRevisionsCount}</span>
                  )}
                </Link>
              </div>

              {/* Groups section */}
              <div className={styles.drawerSection}>
                <h3>Groups</h3>
                <Link href={ROUTES.GROUPS.MY} onClick={() => setIsDrawerOpen(false)}>
                  My Groups
                </Link>
                <Link href={ROUTES.GROUPS.CREATE} onClick={() => setIsDrawerOpen(false)}>
                  Create Group
                </Link>
              </div>

              {/* Notifications section (only for logged in users) */}
              {user && (
                <div className={styles.drawerSection}>
                  <h3>Notifications</h3>
                  <Link href={ROUTES.NOTIFICATIONS.ROOT} onClick={() => setIsDrawerOpen(false)}>
                    View Notifications
                    {unreadCount > 0 && <span className={styles.drawerBadge}>{unreadCount}</span>}
                  </Link>
                </div>
              )}

              {/* Profile section */}
              {user && (
                <div className={styles.drawerSection}>
                  <h3>Profile</h3>
                  <Link
                    href={ROUTES.USER_PROFILE.OWN(user.username)}
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    Profile
                  </Link>
                  {/* <Link href={ROUTES.SHARES.ROOT} onClick={() => setIsDrawerOpen(false)}>
                    Shares
                  </Link> */}
                  <Link href="/settings" onClick={() => setIsDrawerOpen(false)}>
                    Settings
                  </Link>
                  <Button
                    variant="ghost"
                    className={styles.drawerLogout}
                    onClick={() => {
                      logout();
                      setIsDrawerOpen(false);
                    }}
                    leftIcon={<FiLogOut />}
                  >
                    Logout
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className={clsx(styles.mobileNavbar, className)}>
        <div className={styles.mobileNavLinks}>
          {/* Home */}
          <Link
            href={ROUTES.DASHBOARD}
            className={clsx(styles.mobileNavItem, isActive(ROUTES.DASHBOARD) && styles.active)}
            aria-label="Dashboard"
          >
            <FiHome className={styles.mobileIcon} />
            <span className={styles.mobileLabel}>Home</span>
          </Link>

          {/* Revisions */}
          <Link
            href={ROUTES.REVISIONS.ROOT}
            className={clsx(styles.mobileNavItem, isActive(ROUTES.REVISIONS.ROOT) && styles.active)}
            aria-label="Revisions"
          >
            <FiClock className={styles.mobileIcon} />
            <span className={styles.mobileLabel}>Revisions</span>
            {pendingRevisionsCount > 0 && user && (
              <span className={styles.mobileBadge}>{pendingRevisionsCount}</span>
            )}
          </Link>

          {/* Notifications (only for logged in users) */}
          {/* {user && (
            <Link
              href={ROUTES.NOTIFICATIONS.ROOT}
              className={clsx(styles.mobileNavItem, isActive(ROUTES.NOTIFICATIONS.ROOT) && styles.active)}
              aria-label="Notifications"
            >
              <FiBell className={styles.mobileIcon} />
              <span className={styles.mobileLabel}>Alerts</span>
              {unreadCount > 0 && (
                <span className={styles.mobileBadge}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )} */}

          {/* Quick add (plus) – unchanged */}
          <Link
            href={ROUTES.QUESTIONS.CREATE}
            className={styles.quickAddButton}
            aria-label="Add solved question"
          >
            <FiPlus />
          </Link>

          {/* All Sheets – replaces "Groups" */}
          <Link
            href={ROUTES.SHEETS.ROOT}
            className={clsx(styles.mobileNavItem, isActive(ROUTES.SHEETS.ROOT) && styles.active)}
            aria-label="All Sheets"
          >
            <FiGrid className={styles.mobileIcon} />
            <span className={styles.mobileLabel}>Sheets</span>
          </Link>

          {/* All Questions – new button */}
          <Link
            href={ROUTES.QUESTIONS.ROOT}
            className={clsx(styles.mobileNavItem, isActive(ROUTES.QUESTIONS.ROOT) && styles.active)}
            aria-label="All Questions"
          >
            <FiBookOpen className={styles.mobileIcon} />
            <span className={styles.mobileLabel}>Questions</span>
          </Link>

          {/* Profile / Login */}
          <Link
            href={user ? ROUTES.USER_PROFILE.OWN(user.username) : loginHref}
            className={clsx(
              styles.mobileNavItem,
              isActive(ROUTES.USER_PROFILE.OWN(user?.username || '')) && styles.active
            )}
            aria-label={user ? 'Profile' : 'Login'}
            onClick={() => setIsDrawerOpen(false)}
          >
            {user ? (
              <Avatar src={user.avatarUrl} name={user.displayName || user.username} size="xs" />
            ) : (
              <FiUser className={styles.mobileIcon} />
            )}
            <span className={styles.mobileLabel}>{user ? 'Profile' : 'Login'}</span>
          </Link>
        </div>
      </nav>

      <div className={styles.mobileSpacer} />
    </>
  );
};

export default React.memo(Navbar);