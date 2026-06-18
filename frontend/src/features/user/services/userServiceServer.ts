/**
 * Server-side user service for fetching user data.
 * Used in Next.js server components and route handlers.
 * All methods accept an optional token to authenticate the request.
 */

import { userService } from './userService';

export const userServiceServer = {
  /**
   * Fetch a user by their username.
   * @param username – The user's unique username.
   * @param token – Optional authentication token (e.g., from cookies).
   * @returns The user object or null if not found / error.
   */
  async getUserByUsername(username: string, token?: string) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${username}`,
        {
          headers,
          next: { revalidate: 0 },
        }
      );

      if (!res.ok) {
        if (res.status === 404 || res.status === 403 || res.status === 401) {
          return null;
        }
        console.error(`Failed to fetch user ${username}:`, res.status, res.statusText);
        return null;
      }

      const data = await res.json();
      return data.data?.user || null;
    } catch (error) {
      console.error(`Error fetching user ${username}:`, error);
      return null;
    }
  },

  /**
   * Fetch public progress of a user.
   * @param userId – The user's ID.
   * @param params – Optional pagination/limit parameters.
   * @param token – Optional authentication token.
   * @returns The user's public progress data or null.
   */
  async getUserPublicProgress(userId: string, params?: { limit?: number; sortBy?: string; sortOrder?: string }, token?: string) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/progress?${query.toString()}`,
        {
          headers,
          next: { revalidate: 0 },
        }
      );

      if (!res.ok) {
        if (res.status === 404 || res.status === 403 || res.status === 401) {
          return null;
        }
        console.error(`Failed to fetch user progress for ${userId}:`, res.status, res.statusText);
        return null;
      }

      const data = await res.json();
      return data.data?.progress || null;
    } catch (error) {
      console.error(`Error fetching user progress for ${userId}:`, error);
      return null;
    }
  },
};