const mongoose = require('mongoose');
const User = require('../models/User');
const Follow = require('../models/Follow');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const AppError = require('../utils/errors/AppError');
const { generateToken } = require('../middleware/auth');
const { invalidateUserCache, invalidateDashboardCache, invalidateCache } = require('../middleware/cache');
const { paginate } = require('../utils/helpers/pagination');
const { formatResponse } = require('../utils/helpers/response');
const config = require('../config');

const getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user.toObject();
    delete user.__v;
    // Online if last activity within 1 minutes
    user.isOnline = (Date.now() - new Date(user.lastOnline).getTime()) < 1 * 60 * 1000;
    
    // Round masteryRate to 2 decimal places
    if (user.stats && user.stats.masteryRate) {
      user.stats.masteryRate = Math.round(user.stats.masteryRate * 100) / 100;
    }
    
    res.json(formatResponse('User profile retrieved successfully', { user }));
  } catch (error) {
    next(error);
  }
};

const updateCurrentUser = async (req, res, next) => {
  try {
    const updates = {};
    let dashboardInvalidate = false;
    let privacyChanged = false;
    
    if (req.body.displayName) updates.displayName = req.body.displayName;
    if (req.body.preferences) {
      updates.preferences = req.body.preferences;
      // If dailyGoal or weeklyGoal changed, dashboard needs refresh
      if (req.body.preferences.dailyGoal !== undefined || req.body.preferences.weeklyGoal !== undefined) {
        dashboardInvalidate = true;
      }
    }
    if (req.body.privacy) {
      updates.privacy = req.body.privacy;
      privacyChanged = true;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-__v');
    
    await invalidateUserCache(req.user._id);
    if (dashboardInvalidate) {
      await invalidateDashboardCache(req.user._id);
    }
    
    // ========== NEW: Invalidate user list caches if privacy changed ==========
    if (privacyChanged) {
      // Invalidate all authenticated user lists (because visibility of this user for others may change)
      // We cannot invalidate all patterns easily, but we can invalidate the public list cache as well.
      // Since privacy change affects who can see this user, we need to purge all caches that include this user.
      // The safest approach: invalidate all user list caches (both public and any authenticated).
      await invalidateCache('users:public:*');
      await invalidateCache('users:auth:*'); // careful: this removes all authenticated user caches (could be many)
      // A more granular approach would iterate over all users who might have this user in their list,
      // but that's too expensive. Given that privacy changes are relatively rare, the cache purge is acceptable.
    }
    
    // Round masteryRate for response
    if (user.stats && user.stats.masteryRate) {
      user.stats.masteryRate = Math.round(user.stats.masteryRate * 100) / 100;
    }
    
    res.json(formatResponse('User profile updated successfully', { user }));
  } catch (error) {
    next(error);
  }
};

const getUserByUsername = async (req, res, next) => {
  try {
    const user = await User.findOne({
      username: req.params.username,
      privacy: { $in: ['public', 'link-only'] }
    }).select('-__v -email -authProvider -providerId -preferences -isActive');
    
    if (!user) throw new AppError('User not found or profile is private', 404);
    
    const userObj = user.toObject();
    userObj.isOnline = (Date.now() - new Date(userObj.lastOnline).getTime()) < 1 * 60 * 1000;
    
    // Round masteryRate
    if (userObj.stats && userObj.stats.masteryRate) {
      userObj.stats.masteryRate = Math.round(userObj.stats.masteryRate * 100) / 100;
    }
    
    res.json(formatResponse('User profile retrieved successfully', { user: userObj }));
  } catch (error) {
    next(error);
  }
};

const getUserStats = async (req, res, next) => {
  try {
    const stats = {
      stats: req.user.stats,
      currentStreak: req.user.streak.current,
      longestStreak: req.user.streak.longest,
      followersCount: req.user.followersCount,
      followingCount: req.user.followingCount,
      goals: {
        daily: req.user.preferences.dailyGoal,
        weekly: req.user.preferences.weeklyGoal,
        dailyProgress: 0,
        weeklyProgress: 0
      }
    };
    
    // Round masteryRate if present
    if (stats.stats && stats.stats.masteryRate) {
      stats.stats.masteryRate = Math.round(stats.stats.masteryRate * 100) / 100;
    }
    
    res.json(formatResponse('User statistics retrieved successfully', stats));
  } catch (error) {
    next(error);
  }
};

const updateLastOnline = async (req, res, next) => {
  try {
    const now = new Date();
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { lastOnline: now },
      { new: true }
    ).select('lastOnline');
    
    await invalidateUserCache(req.user._id);
    res.json(formatResponse('Last online updated successfully', { lastOnline: user.lastOnline }));
  } catch (error) {
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const query = {
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } }
      ],
      privacy: { $in: ['public', 'link-only'] }
    };
    
    const users = await User.find(query)
      .select('username displayName avatarUrl streak stats privacy')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    // Round masteryRate for each user
    const usersWithRoundedStats = users.map(user => {
      const u = user.toObject();
      if (u.stats && u.stats.masteryRate) {
        u.stats.masteryRate = Math.round(u.stats.masteryRate * 100) / 100;
      }
      return u;
    });
    
    const total = await User.countDocuments(query);
    const pagination = paginate(total, page, limit);
    
    res.json(formatResponse('Users retrieved successfully', { users: usersWithRoundedStats }, pagination));
  } catch (error) {
    next(error);
  }
};

const getTopStreaks = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const users = await User.find({ privacy: { $in: ['public', 'link-only'] } })
      .sort({ 'streak.current': -1 })
      .select('username displayName avatarUrl streak stats privacy')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const usersWithRoundedStats = users.map(user => {
      const u = user.toObject();
      if (u.stats && u.stats.masteryRate) {
        u.stats.masteryRate = Math.round(u.stats.masteryRate * 100) / 100;
      }
      return u;
    });
    
    const total = await User.countDocuments({ privacy: { $in: ['public', 'link-only'] } });
    const pagination = paginate(total, page, limit);
    
    res.json(formatResponse('Top streak users retrieved successfully', { users: usersWithRoundedStats }, pagination));
  } catch (error) {
    next(error);
  }
};

const getTopSolved = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const users = await User.find({ privacy: { $in: ['public', 'link-only'] } })
      .sort({ 'stats.totalSolved': -1 })
      .select('username displayName avatarUrl streak stats privacy')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const usersWithRoundedStats = users.map(user => {
      const u = user.toObject();
      if (u.stats && u.stats.masteryRate) {
        u.stats.masteryRate = Math.round(u.stats.masteryRate * 100) / 100;
      }
      return u;
    });
    
    const total = await User.countDocuments({ privacy: { $in: ['public', 'link-only'] } });
    const pagination = paginate(total, page, limit);
    
    res.json(formatResponse('Top solved users retrieved successfully', { users: usersWithRoundedStats }, pagination));
  } catch (error) {
    next(error);
  }
};

const deleteCurrentUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    await invalidateUserCache(req.user._id);
    await invalidateDashboardCache(req.user._id);
    res.json(formatResponse('Account deleted successfully'));
  } catch (error) {
    next(error);
  }
};

const checkUsernameAvailability = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    res.json(formatResponse('Username availability checked', {
      available: !user,
      username: req.params.username
    }));
  } catch (error) {
    next(error);
  }
};

const getUserPublicProgress = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit) || 6, 6);
    const { sortBy = 'solvedAt', sortOrder = 'desc' } = req.query;

    let sortField;
    if (sortBy === 'solvedAt') {
      sortField = 'attempts.solvedAt';
    } else if (sortBy === 'lastAttemptAt') {
      sortField = 'attempts.lastAttemptAt';
    } else if (sortBy === 'confidenceLevel') {
      sortField = 'confidenceLevel';
    } else if (sortBy === 'totalTimeSpent') {
      sortField = 'totalTimeSpent';
    } else {
      sortField = 'attempts.solvedAt';
    }

    const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    const user = await User.findById(userId).select('privacy username displayName avatarUrl');
    if (!user) throw new AppError('User not found', 404);
    if (user.privacy !== 'public') throw new AppError('User progress is private', 403);

    const progress = await UserQuestionProgress.find({
      userId,
      status: 'Solved'
    })
      .sort(sort)
      .limit(limit)
      .populate('questionId', '_id title problemLink platform difficulty tags pattern')
      .select('_id questionId status attempts.solvedAt attempts.count attempts.lastAttemptAt attempts.firstAttemptAt revisionCount totalTimeSpent confidenceLevel')
      .lean();

    const formattedProgress = progress.map(p => ({
      _id: p._id,
      questionId: p.questionId,
      status: p.status,
      solvedAt: p.attempts?.solvedAt,
      attempts: {
        count: p.attempts?.count || 0,
        lastAttemptAt: p.attempts?.lastAttemptAt,
        firstAttemptAt: p.attempts?.firstAttemptAt
      },
      revisionCount: p.revisionCount || 0,
      totalTimeSpent: p.totalTimeSpent,
      confidenceLevel: p.confidenceLevel
    }));

    res.json(formatResponse('User public progress retrieved successfully', { progress: formattedProgress }));
  } catch (error) {
    next(error);
  }
};

const changeTimezone = async (req, res, next) => {
  try {
    const { newTimezone, confirm } = req.body;
    const userId = req.user._id;
    const oldTimezone = req.user.preferences?.timezone || 'UTC';

    if (oldTimezone === newTimezone) {
      return res.json(formatResponse('Timezone already set to ' + newTimezone, { timezone: newTimezone }));
    }

    if (!confirm) {
      return res.status(400).json(formatResponse(
        'Changing timezone may affect revision schedules and goals. All due dates will be adjusted to keep the same local dates in the new timezone. This operation may take a few seconds. Please confirm with { confirm: true }',
        { requiredConfirmation: true, oldTimezone, newTimezone }
      ));
    }

    const { jobQueue } = require('../services/queue.service');
    await jobQueue.add('user.timezone_change', {
      userId,
      oldTimezone,
      newTimezone,
      triggeredAt: new Date(),
    });

    if (!req.user.preferences) req.user.preferences = {};
    req.user.preferences.timezone = newTimezone;
    await req.user.save();
    await invalidateUserCache(userId);
    await invalidateDashboardCache(userId);

    res.json(formatResponse('Timezone change queued. Data adjustment will complete shortly.', {
      oldTimezone,
      newTimezone,
    }));
  } catch (error) {
    next(error);
  }
};

// ========== HELPER: Batch fetch mutual friends counts for given user IDs ==========
const getMutualFriendsCounts = async (targetUserIds, currentUserFollowingIds) => {
  if (!targetUserIds.length || !currentUserFollowingIds.length) {
    return new Map();
  }
  // Fetch all follow relationships where followerId is in targetUserIds
  const follows = await Follow.find({
    followerId: { $in: targetUserIds },
    isActive: true
  }).select('followerId followedId').lean();
  
  // Group followed IDs by followerId
  const userFollowingMap = new Map();
  follows.forEach(f => {
    const followerStr = f.followerId.toString();
    if (!userFollowingMap.has(followerStr)) userFollowingMap.set(followerStr, []);
    userFollowingMap.get(followerStr).push(f.followedId.toString());
  });
  
  // For each target user, compute intersection with currentUserFollowingIds
  const mutualCounts = new Map();
  const currentFollowingSet = new Set(currentUserFollowingIds);
  for (const userId of targetUserIds) {
    const following = userFollowingMap.get(userId.toString()) || [];
    let mutual = 0;
    for (const followed of following) {
      if (currentFollowingSet.has(followed)) mutual++;
    }
    mutualCounts.set(userId.toString(), mutual);
  }
  return mutualCounts;
};

// ========== GET /users - OPTIMIZED VERSION ==========
const getAllUsers = async (req, res, next) => {
  try {
    // 1. Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || config.userList?.defaultLimit || 20;
    const maxPage = config.userList?.maxPage || 100;
    const maxLimit = config.userList?.maxLimit || 100;
    if (page > maxPage) page = maxPage;
    if (limit > maxLimit) limit = maxLimit;
    const skip = (page - 1) * limit;
    const searchTerm = req.query.search ? req.query.search.trim() : null;

    // 2. Multi‑field sort parsing
    let sortByFields = ['totalSolved'];
    let sortOrders = ['desc'];
    if (req.query.sortBy) {
      sortByFields = req.query.sortBy.split(',').slice(0, 5);
    }
    if (req.query.sortOrder) {
      const orderParts = req.query.sortOrder.split(',');
      sortOrders = orderParts.slice(0, sortByFields.length);
      while (sortOrders.length < sortByFields.length) {
        sortOrders.push(sortOrders[sortOrders.length - 1] || 'desc');
      }
    } else {
      sortOrders = sortByFields.map(() => 'desc');
    }

    const sortObj = {};
    for (let i = 0; i < sortByFields.length; i++) {
      const field = sortByFields[i];
      const order = sortOrders[i] === 'asc' ? 1 : -1;
      let dbField = field;
      if (field === 'mutualFriends') dbField = 'mutualFriendsCount';
      else if (field === 'iFollow') dbField = 'iFollow';
      else if (field === 'followsMe') dbField = 'followsMe';
      sortObj[dbField] = order;
    }

    // 3. Get authenticated user info (following/followers sets)
    let currentUserId = null;
    let currentUserFollowingIds = [];
    let currentUserFollowersSet = null;
    let mutualUserIdsSet = new Set();

    if (req.user) {
      currentUserId = req.user._id;
      const Follow = require('../models/Follow');
      
      const following = await Follow.find({ followerId: currentUserId, isActive: true })
        .select('followedId').lean();
      currentUserFollowingIds = following.map(f => f.followedId.toString());
      
      const followers = await Follow.find({ followedId: currentUserId, isActive: true })
        .select('followerId').lean();
      const followerIds = followers.map(f => f.followerId.toString());
      currentUserFollowersSet = new Set(followerIds);
      
      mutualUserIdsSet = new Set(
        currentUserFollowingIds.filter(id => currentUserFollowersSet.has(id))
      );
    }

    // 4. Visibility match (public/link‑only OR private + mutual)
    const visibilityMatch = {
      $or: [
        { privacy: { $in: ['public', 'link-only'] }, isActive: true },
        ...(req.user && mutualUserIdsSet.size > 0 ? [{
          privacy: 'private',
          isActive: true,
          _id: { $in: Array.from(mutualUserIdsSet).map(id => new mongoose.Types.ObjectId(id)) }
        }] : [])
      ]
    };

    // Helper: build base pipeline (visibility, exclude self, search, projection)
    const getBasePipeline = () => {
      const pipeline = [
        { $match: visibilityMatch },
        ...(currentUserId ? [{ $match: { _id: { $ne: currentUserId } } }] : []),
      ];
      if (searchTerm) {
        const regex = new RegExp('^' + searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        pipeline.push({
          $match: {
            $or: [
              { username: regex },
              { displayName: regex }
            ]
          }
        });
      }
      pipeline.push({
        $project: {
          _id: 1,
          username: 1,
          displayName: 1,
          avatarUrl: 1,
          lastOnline: 1,
          totalSolved: '$stats.totalSolved',
          masteryRate: '$stats.masteryRate',
          totalTimeSpent: '$stats.totalTimeSpent',
          createdAt: 1,
        }
      });
      return pipeline;
    };

    // Determine if we need aggregation (dynamic sort fields)
    const dynamicFields = ['mutualFriends', 'iFollow', 'followsMe'];
    const hasDynamicSort = sortByFields.some(f => dynamicFields.includes(f));
    const needsAggregation = (req.user && hasDynamicSort);

    let users = [];
    let total = 0;

    if (needsAggregation) {
      // ---------- Strategy A: full aggregation with $lookup ----------
      const pipeline = getBasePipeline();
      
      pipeline.push({
        $lookup: {
          from: 'follows',
          let: { targetUserId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$followerId', '$$targetUserId'] },
              { $eq: ['$isActive', true] }
            ] } } },
            { $project: { followedId: 1, _id: 0 } }
          ],
          as: 'targetFollowing'
        }
      });
      pipeline.push({
        $addFields: {
          mutualFriendsCount: {
            $size: {
              $setIntersection: [
                currentUserFollowingIds,
                { $map: { input: '$targetFollowing', as: 'tf', in: { $toString: '$$tf.followedId' } } }
              ]
            }
          },
          iFollow: { $in: [{ $toString: '$_id' }, currentUserFollowingIds] },
          followsMe: { $in: [{ $toString: '$_id' }, Array.from(currentUserFollowersSet || [])] }
        }
      });
      pipeline.push({ $project: { targetFollowing: 0 } });
      
      // Apply filter when the first sort field is a dynamic one (same as original)
      const firstSortField = sortByFields[0];
      if (firstSortField === 'mutualFriends') {
        pipeline.push({ $match: { mutualFriendsCount: { $gt: 0 } } });
      } else if (firstSortField === 'iFollow') {
        pipeline.push({ $match: { iFollow: true } });
      } else if (firstSortField === 'followsMe') {
        pipeline.push({ $match: { followsMe: true } });
      }
      
      pipeline.push({ $sort: sortObj });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      
      users = await User.aggregate(pipeline);
      
      // Count total (with same filters)
      const countPipeline = getBasePipeline();
      countPipeline.push({
        $lookup: {
          from: 'follows',
          let: { targetUserId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$followerId', '$$targetUserId'] },
              { $eq: ['$isActive', true] }
            ] } } },
            { $project: { followedId: 1 } }
          ],
          as: 'targetFollowing'
        }
      });
      countPipeline.push({
        $addFields: {
          mutualFriendsCount: {
            $size: {
              $setIntersection: [
                currentUserFollowingIds,
                { $map: { input: '$targetFollowing', as: 'tf', in: { $toString: '$$tf.followedId' } } }
              ]
            }
          },
          iFollow: { $in: [{ $toString: '$_id' }, currentUserFollowingIds] },
          followsMe: { $in: [{ $toString: '$_id' }, Array.from(currentUserFollowersSet || [])] }
        }
      });
      if (firstSortField === 'mutualFriends') {
        countPipeline.push({ $match: { mutualFriendsCount: { $gt: 0 } } });
      } else if (firstSortField === 'iFollow') {
        countPipeline.push({ $match: { iFollow: true } });
      } else if (firstSortField === 'followsMe') {
        countPipeline.push({ $match: { followsMe: true } });
      }
      countPipeline.push({ $count: 'total' });
      const countResult = await User.aggregate(countPipeline);
      total = countResult.length ? countResult[0].total : 0;
      
    } else {
      // ---------- Strategy B: fetch paginated users, compute follow fields after ----------
      const pipeline = getBasePipeline();
      
      pipeline.push({ $sort: sortObj });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      
      users = await User.aggregate(pipeline);
      
      if (req.user) {
        const userIds = users.map(u => u._id.toString());
        const mutualCounts = await getMutualFriendsCounts(userIds, currentUserFollowingIds);
        const currentFollowingSet = new Set(currentUserFollowingIds);
        const currentFollowersSet = currentUserFollowersSet || new Set();
        
        users = users.map(u => {
          const uid = u._id.toString();
          return {
            ...u,
            mutualFriendsCount: mutualCounts.get(uid) || 0,
            iFollow: currentFollowingSet.has(uid),
            followsMe: currentFollowersSet.has(uid)
          };
        });
      } else {
        users = users.map(u => ({ ...u }));
      }
      
      // Count total (without dynamic filters)
      const countPipeline = getBasePipeline();
      countPipeline.push({ $count: 'total' });
      const countResult = await User.aggregate(countPipeline);
      total = countResult.length ? countResult[0].total : 0;
    }

    // 5. Compute `isOnline` (based on lastOnline, threshold 5 minutes)
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const now = Date.now();
    users = users.map(user => {
      let isOnline = false;
      if (user.lastOnline) {
        const lastOnlineTime = new Date(user.lastOnline).getTime();
        isOnline = (now - lastOnlineTime) < ONLINE_THRESHOLD_MS;
      }
      return { ...user, isOnline };
    });

    // 6. Format response
    users.forEach(user => {
      if (user.masteryRate) user.masteryRate = Math.round(user.masteryRate * 100) / 100;
      if (user.totalTimeSpent === undefined) user.totalTimeSpent = 0;
    });

    const formattedUsers = users.map(user => {
      const result = {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        totalSolved: user.totalSolved,
        masteryRate: user.masteryRate,
        totalTimeSpent: user.totalTimeSpent,
        isOnline: user.isOnline,
      };
      if (req.user && user.mutualFriendsCount !== undefined) {
        result.mutualFriends = user.mutualFriendsCount;
      }
      if (req.user) {
        result.iFollow = user.iFollow === true;
        result.followsMe = user.followsMe === true;
      }
      return result;
    });

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };

    res.json(formatResponse('Users retrieved successfully', { users: formattedUsers }, { pagination }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  getUserByUsername,
  getUserStats,
  updateLastOnline,
  searchUsers,
  getTopStreaks,
  getTopSolved,
  deleteCurrentUser,
  checkUsernameAvailability,
  getUserPublicProgress,
  changeTimezone,
  getAllUsers,
};