'use client';

import React, { useState } from 'react';
import { FiSettings, FiCalendar, FiStar, FiUsers, FiTarget, FiAward } from 'react-icons/fi';
import { FaFire, FaTrophy, FaLeaf, FaRegGem, FaStar } from 'react-icons/fa';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import clsx from 'clsx';
import { format } from 'date-fns';
import { Avatar } from '@/shared/components/Avatar';
import Button from '@/shared/components/Button';
import Divider from '@/shared/components/Divider';
import Modal from '@/shared/components/Modal';
import Checkbox from '@/shared/components/Checkbox';
import ThemeToggle from '@/shared/components/ThemeToggle';
import { toast } from '@/shared/components/Toast';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { followService } from '@/features/follow/services/followService';
import { userService } from '@/features/user/services/userService';
import { userKeys } from '@/shared/lib/react-query';
import { formatNumber } from '@/shared/lib/stringUtils';
import type { User } from '@/shared/types';
import styles from './ProfileHeader.module.css';

export interface ProfileHeaderProps {
  user: User;
  isOwnProfile?: boolean;
  className?: string;
}

// Helper to compute badges from user stats
const computeBadges = (user: User) => {
  const badges: Array<{ label: string; icon: React.ReactNode }> = [];
  const { totalSolved } = user?.stats;
  const { current } = user?.streak;
  const { masteryRate, totalRevisions, activeDays } = user?.stats;

  if (totalSolved >= 100) badges.push({ label: 'Century Club', icon: <FaTrophy /> });
  if (totalSolved >= 500) badges.push({ label: 'Half‑Millennium', icon: <FaRegGem /> });
  if (current >= 30) badges.push({ label: 'Streak Keeper', icon: <FaFire /> });
  if (masteryRate >= 80) badges.push({ label: 'Top 10%', icon: <FaStar /> });
  if (totalRevisions >= 100) badges.push({ label: 'Revision Master', icon: <FiTarget /> });
  if (activeDays >= 100) badges.push({ label: 'Faithful', icon: <FaLeaf /> });

  return badges;
};

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  isOwnProfile = false,
  className,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Follow status – only fetch if not own profile and logged in
  const { data: followStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['follow', 'status', currentUser?._id, user._id],
    queryFn: () => followService.getFollowStatus(user._id),
    enabled: !isOwnProfile && !!currentUser,
    staleTime: 2 * 60 * 1000,
  });

  // Follow / unfollow mutations
  const followMutation = useMutation({
    mutationFn: () => followService.followUser(user._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow', 'status', currentUser?._id, user._id] });
      queryClient.invalidateQueries({ queryKey: ['follow'] });
      toast.success(`You are now following ${user.displayName || user.username}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to follow user');
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => followService.unfollowUser(user._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow', 'status', currentUser?._id, user._id] });
      queryClient.invalidateQueries({ queryKey: ['follow'] });
      toast.success(`You have unfollowed ${user.displayName || user.username}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unfollow user');
    },
  });

  const handleFollowToggle = () => {
    if (followStatus?.isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  const isOnline = user?.isOnline ?? false;
  const badges = computeBadges(user);
  const memberSince = format(new Date(user?.accountCreated), 'MMM yyyy');

  // Settings modal form (only for own profile)
  const { control, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      displayName: user?.displayName,
      dailyGoal: user?.preferences?.dailyGoal,
      weeklyGoal: user?.preferences?.weeklyGoal,
      timezone: user?.preferences?.timezone,
      notifications: {
        revisionReminders: user?.preferences?.notifications?.revisionReminders,
        goalTracking: user?.preferences?.notifications?.goalTracking,
        socialInteractions: user?.preferences?.notifications?.socialInteractions,
        weeklyReports: user?.preferences?.notifications?.weeklyReports,
      },
    },
  });

  const updatePreferences = useMutation({
    mutationFn: (data: Partial<User>) => userService.updateUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
      toast.success('Profile updated');
      setModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  const onSubmit = (data: any) => {
    const { displayName, dailyGoal, weeklyGoal, timezone, notifications } = data;
    const payload: Partial<User> = {};

    if (displayName !== user?.displayName) {
      payload.displayName = displayName;
    }

    const newPreferences = {
      ...user?.preferences,
      dailyGoal,
      weeklyGoal,
      timezone,
      notifications: {
        ...user?.preferences.notifications,
        ...notifications,
      },
    };

    if (
      newPreferences.dailyGoal !== user?.preferences?.dailyGoal ||
      newPreferences.weeklyGoal !== user?.preferences?.weeklyGoal ||
      newPreferences.timezone !== user?.preferences?.timezone ||
      newPreferences.notifications.revisionReminders !== user?.preferences?.notifications?.revisionReminders ||
      newPreferences.notifications.goalTracking !== user?.preferences?.notifications?.goalTracking ||
      newPreferences.notifications.socialInteractions !== user?.preferences?.notifications?.socialInteractions ||
      newPreferences.notifications.weeklyReports !== user?.preferences?.notifications?.weeklyReports
    ) {
      payload.preferences = newPreferences;
    }

    updatePreferences.mutate(payload);
  };

  return (
    <>
      <div className={clsx(styles.container, className)}>
        {/* Avatar with triple ripple effect */}
        <div className={styles.avatarWrapper}>
          <Avatar
            src={user?.avatarUrl}
            name={user?.displayName || user?.username}
            size="xl"
            status={isOnline ? 'online' : 'offline'}
            className={styles.avatar}
          />
          <div className={styles.ripple} aria-hidden="true" />
          <div className={styles.ripple} aria-hidden="true" />
          <div className={styles.ripple} aria-hidden="true" />
        </div>

        {/* Name and action button(s) */}
        <div className={styles.nameSection}>
          <div className={styles.nameRow}>
            <h1 className={styles.displayName}>{user?.displayName}</h1>
            {isOwnProfile ? (
              <button className={styles.settingsButton} onClick={() => setModalOpen(true)} aria-label="Open settings">
                <FiSettings />
              </button>
            ) : (
              currentUser && (
                <Button
                  variant={followStatus?.isFollowing ? 'outline' : 'primary'}
                  size="sm"
                  onClick={handleFollowToggle}
                  isLoading={followMutation.isPending || unfollowMutation.isPending}
                  disabled={statusLoading}
                >
                  {followStatus?.isFollowing ? 'Unfollow' : 'Follow'}
                </Button>
              )
            )}
          </div>
          <p className={styles.username}>@{user?.username}</p>
          <div className={styles.memberSince}>
            <FiCalendar /> member since {memberSince}
          </div>
        </div>

        {/* Solved trunk */}
        <div className={styles.trunk}>
          <span className={styles.trunkValue}>{formatNumber(user?.stats.totalSolved)}</span>
          <span className={styles.trunkLabel}>total question solved</span>
        </div>

        {/* Stat pills */}
        <div className={styles.statPills}>
          <div className={styles.statPill}>
            <FaFire className={styles.statPillIcon} />
            <span className={styles.statPillValue}>{user?.streak.current}</span>
            <span className={styles.statPillLabel}>streak</span>
          </div>
          <div className={styles.statPill}>
            <FiStar className={styles.statPillIcon} />
            <span className={styles.statPillValue}>{user?.stats.masteryRate}%</span>
            <span className={styles.statPillLabel}>mastery</span>
          </div>
          <div className={styles.statPill}>
            <FiUsers className={styles.statPillIcon} />
            <span className={styles.statPillValue}>{formatNumber(user?.followersCount)}</span>
            <span className={styles.statPillLabel}>followers</span>
          </div>
          <div className={styles.statPill}>
            <FiUsers className={styles.statPillIcon} />
            <span className={styles.statPillValue}>{formatNumber(user?.followingCount)}</span>
            <span className={styles.statPillLabel}>following</span>
          </div>
          <div className={styles.statPill}>
            <FiAward className={styles.statPillIcon} />
            <span className={styles.statPillValue}>{user?.streak.longest}</span>
            <span className={styles.statPillLabel}>longest</span>
          </div>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className={styles.badges}>
            {badges.map((badge, idx) => (
              <div key={idx} className={styles.badge}>
                <span className={styles.badgeIcon}>{badge.icon}</span>
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal (only for own profile) */}
      {isOwnProfile && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Preferences"
          size="md"
          closeOnBackdropClick
          closeOnEsc
          showCloseButton
        >
          <form onSubmit={handleSubmit(onSubmit)} className={styles.modalForm}>
            <div className={styles.formGroup}>
              <label htmlFor="displayName">Display Name</label>
              <input id="displayName" type="text" {...control.register('displayName')} />
            </div>

            {/* <div className={styles.formGroup}>
              <label htmlFor="dailyGoal">Daily Goal</label>
              <input
                id="dailyGoal"
                type="number"
                min={1}
                max={50}
                {...control.register('dailyGoal', { valueAsNumber: true })}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="weeklyGoal">Weekly Goal</label>
              <input
                id="weeklyGoal"
                type="number"
                min={5}
                max={100}
                {...control.register('weeklyGoal', { valueAsNumber: true })}
              />
            </div> */}
            {/* <div className={styles.formGroup}>
              <label htmlFor="timezone">Timezone</label>
              <select {...control.register('timezone')}>
                <option value="UTC">UTC</option>
                <option value="UTC+5:30">Asia/Kolkata (UTC+5:30)</option>
                <option value="UTC-5">America/New York (UTC-5)</option>
              </select>
            </div> */}
            <fieldset className={styles.notifications}>
              <legend>Notifications</legend>
              <Controller
                name="notifications.revisionReminders"
                control={control}
                render={({ field }) => (
                  <Checkbox label="Revision Reminders" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="notifications.goalTracking"
                control={control}
                render={({ field }) => (
                  <Checkbox label="Goal Tracking" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="notifications.socialInteractions"
                control={control}
                render={({ field }) => (
                  <Checkbox label="Social Interactions" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="notifications.weeklyReports"
                control={control}
                render={({ field }) => (
                  <Checkbox label="Weekly Reports" checked={field.value} onChange={field.onChange} />
                )}
              />
            </fieldset>

            <Divider />

            <div className={styles.themeSection}>
              <span>Theme</span>
              <ThemeToggle variant="both" />
            </div>
          </form>

          <div className={styles.modalActions}>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              Save
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default ProfileHeader;