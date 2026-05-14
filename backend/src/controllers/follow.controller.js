const Follow = require('../models/Follow');
const User = require('../models/User');
const AppError = require('../utils/errors/AppError');
const { invalidateCache } = require('../middleware/cache');
const { paginate } = require('../utils/helpers/pagination');
const { formatResponse } = require('../utils/helpers/response');
const { jobQueue } = require('../services/queue.service');

const getFollowing = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [follows, total] = await Promise.all([
      Follow.find({ followerId: req.user._id, isActive: true })
        .populate('followedId', 'username displayName avatarUrl stats streak privacy')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Follow.countDocuments({ followerId: req.user._id, isActive: true })
    ]);

    const pagination = paginate(total, page, limit);
    res.json(formatResponse('Following list retrieved successfully', { following: follows }, pagination));
  } catch (error) {
    next(error);
  }
};

const getFollowers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [follows, total] = await Promise.all([
      Follow.find({ followedId: req.user._id, isActive: true })
        .populate('followerId', 'username displayName avatarUrl stats streak privacy')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Follow.countDocuments({ followedId: req.user._id, isActive: true })
    ]);

    const pagination = paginate(total, page, limit);
    res.json(formatResponse('Followers list retrieved successfully', { followers: follows }, pagination));
  } catch (error) {
    next(error);
  }
};

const followUser = async (req, res, next) => {
  try {
    const followedId = req.params.userId;
    if (req.user._id.toString() === followedId) throw new AppError('Cannot follow yourself', 400);

    const [userExists, existingFollow] = await Promise.all([
      User.findById(followedId),
      Follow.findOne({ followerId: req.user._id, followedId, isActive: true })
    ]);

    if (!userExists) throw new AppError('User not found', 404);
    if (existingFollow) throw new AppError('Already following this user', 409);

    const follow = await Follow.findOneAndUpdate(
      { followerId: req.user._id, followedId },
      { $set: { action: 'follow', isActive: true, updatedAt: new Date() } },
      { upsert: true, new: true, runValidators: true }
    );

    await Promise.all([
      User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } }),
      User.findByIdAndUpdate(followedId, { $inc: { followersCount: 1 } })
    ]);

    await invalidateCache(`follow:*:user:${req.user._id}:*`);
    await invalidateCache(`follow:*:user:${followedId}:*`);
    await invalidateCache(`users:*:public:*`);
    
    // ========== NEW: Invalidate user list caches ==========
    // The authenticated user's list (their view of users) changes because mutual friends counts may change
    await invalidateCache(`users:auth:${req.user._id}:*`);
    // Also the target user's list (their view of users) changes because their mutual friends with others may change
    await invalidateCache(`users:auth:${followedId}:*`);
    // Public user list (unauthenticated) does NOT change because mutual friends are not shown, 
    // but visibility of private users might change if a mutual relationship is formed.
    // To be safe, we also invalidate the public list (since a private user may become visible to the authenticated user only,
    // but the public list remains the same; however, if the target user's privacy is private, they remain hidden from public.
    // No need to invalidate public list; it's unaffected.
    // However, if the user who followed was private and now has a mutual follow with the target, 
    // the target might see them in their own authenticated list. That's already covered by invalidating target's auth cache.
    // So we skip public cache invalidation to avoid unnecessary purges.

    // Emit event for new follower
    await jobQueue.add('follower.new', {
      followerId: req.user._id,
      followedId,
      createdAt: follow.createdAt
    });

    const counts = {
      followingCount: req.user.followingCount + 1,
      followersCount: userExists.followersCount + 1
    };

    res.status(201).json(formatResponse('User followed successfully', { follow, counts }));
  } catch (error) {
    next(error);
  }
};

const unfollowUser = async (req, res, next) => {
  try {
    const followedId = req.params.userId;
    const follow = await Follow.findOne({ followerId: req.user._id, followedId, isActive: true });
    if (!follow) throw new AppError('Not following this user', 404);

    follow.isActive = false;
    follow.action = 'unfollow';
    follow.updatedAt = new Date();
    await follow.save();

    await Promise.all([
      User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } }),
      User.findByIdAndUpdate(followedId, { $inc: { followersCount: -1 } })
    ]);

    await invalidateCache(`follow:*:user:${req.user._id}:*`);
    await invalidateCache(`follow:*:user:${followedId}:*`);
    await invalidateCache(`users:*:public:*`);
    
    // ========== NEW: Invalidate user list caches ==========
    await invalidateCache(`users:auth:${req.user._id}:*`);
    await invalidateCache(`users:auth:${followedId}:*`);

    const [followingCount, followersCount] = await Promise.all([
      Follow.countDocuments({ followerId: req.user._id, isActive: true }),
      Follow.countDocuments({ followedId: req.user._id, isActive: true })
    ]);

    res.json(formatResponse('User unfollowed successfully', { 
      follow, 
      counts: { followingCount, followersCount } 
    }));
  } catch (error) {
    next(error);
  }
};

const getFollowStatus = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const [isFollowing, isFollowedBy] = await Promise.all([
      Follow.findOne({ followerId: req.user._id, followedId: targetUserId, isActive: true }),
      Follow.findOne({ followerId: targetUserId, followedId: req.user._id, isActive: true })
    ]);

    const followStatus = {
      isFollowing: !!isFollowing,
      isFollowedBy: !!isFollowedBy,
      followId: isFollowing?._id,
      createdAt: isFollowing?.createdAt
    };

    res.json(formatResponse('Follow status retrieved', { followStatus }));
  } catch (error) {
    next(error);
  }
};

const getSuggestions = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const following = await Follow.distinct('followedId', { 
      followerId: req.user._id, 
      isActive: true 
    });

    const suggestions = await User.aggregate([
      { $match: { 
        _id: { $ne: req.user._id, $nin: following },
        privacy: { $in: ['public', 'link-only'] }
      }},
      { $sample: { size: limit } },
      { $project: { 
        username: 1, 
        displayName: 1, 
        avatarUrl: 1, 
        stats: 1, 
        streak: 1, 
        privacy: 1 
      }}
    ]);

    const suggestionsWithMutual = await Promise.all(suggestions.map(async user => {
      const mutualFollowers = await Follow.countDocuments({
        followedId: user._id,
        followerId: { $in: following },
        isActive: true
      });
      return { ...user, mutualFollowers, reason: 'Similar problem-solving patterns' };
    }));

    res.json(formatResponse('Follow suggestions retrieved', { suggestions: suggestionsWithMutual }));
  } catch (error) {
    next(error);
  }
};

const getPublicFollowing = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.userId).select('username privacy followingCount');
    if (!targetUser) throw new AppError('User not found', 404);
    if (targetUser.privacy === 'private' && targetUser._id.toString() !== req.user._id.toString()) {
      throw new AppError('User\'s following list is private', 403);
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [following, total] = await Promise.all([
      Follow.find({ followerId: targetUser._id, isActive: true })
        .populate('followedId', 'username displayName avatarUrl stats streak privacy')
        .skip(skip)
        .limit(parseInt(limit)),
      Follow.countDocuments({ followerId: targetUser._id, isActive: true })
    ]);

    const pagination = paginate(total, page, limit);
    res.json(formatResponse('User\'s following list retrieved', { 
      following: following.map(f => f.followedId), 
      user: targetUser 
    }, pagination));
  } catch (error) {
    next(error);
  }
};

const getPublicFollowers = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.userId).select('username privacy followersCount');
    if (!targetUser) throw new AppError('User not found', 404);
    if (targetUser.privacy === 'private' && targetUser._id.toString() !== req.user._id.toString()) {
      throw new AppError('User\'s followers list is private', 403);
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      Follow.find({ followedId: targetUser._id, isActive: true })
        .populate('followerId', 'username displayName avatarUrl stats streak privacy')
        .skip(skip)
        .limit(parseInt(limit)),
      Follow.countDocuments({ followedId: targetUser._id, isActive: true })
    ]);

    const pagination = paginate(total, page, limit);
    res.json(formatResponse('User\'s followers list retrieved', { 
      followers: followers.map(f => f.followerId), 
      user: targetUser 
    }, pagination));
  } catch (error) {
    next(error);
  }
};

const getMutualFollows = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const limit = parseInt(req.query.limit) || 10;

    const [myFollowing, theirFollowing] = await Promise.all([
      Follow.distinct('followedId', { followerId: req.user._id, isActive: true }),
      Follow.distinct('followedId', { followerId: targetUserId, isActive: true })
    ]);

    const mutualIds = myFollowing.filter(id => theirFollowing.includes(id.toString()));
    
    const mutualFollows = await User.find({ 
      _id: { $in: mutualIds.slice(0, limit) } 
    }).select('username displayName avatarUrl');

    res.json(formatResponse('Mutual follows retrieved', { 
      mutualFollows, 
      count: mutualIds.length 
    }));
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const [followingCount, followersCount, mutualCount, newFollowersLast7Days] = await Promise.all([
      Follow.countDocuments({ followerId: req.user._id, isActive: true }),
      Follow.countDocuments({ followedId: req.user._id, isActive: true }),
      Follow.countDocuments({ 
        followerId: { $in: await Follow.distinct('followedId', { followerId: req.user._id, isActive: true }) },
        followedId: req.user._id,
        isActive: true 
      }),
      Follow.countDocuments({ 
        followedId: req.user._id, 
        isActive: true,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    const topFollowers = await Follow.find({ followedId: req.user._id, isActive: true })
      .populate('followerId', 'username')
      .sort({ createdAt: -1 })
      .limit(5);

    const followingDistribution = {
      byActivity: { high: 0, medium: 0, low: 0 },
      byStreak: { high: 0, medium: 0, low: 0 }
    };

    const stats = {
      followingCount,
      followersCount,
      mutualCount,
      newFollowersLast7Days,
      topFollowers: topFollowers.map(f => ({
        userId: f.followerId._id,
        username: f.followerId.username,
        followedSince: f.createdAt
      })),
      followingDistribution
    };

    res.json(formatResponse('Follow statistics retrieved', { stats }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFollowing,
  getFollowers,
  followUser,
  unfollowUser,
  getFollowStatus,
  getSuggestions,
  getPublicFollowing,
  getPublicFollowers,
  getMutualFollows,
  getStats
};