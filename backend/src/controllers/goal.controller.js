// src/controllers/goal.controller.js
const Goal = require("../models/Goal");
const User = require("../models/User");
const { formatResponse, paginate, getPaginationParams, getStartOfDay, getEndOfDay, getStartOfWeek, getEndOfWeek, formatDate } = require("../utils/helpers");
const { invalidateCache, invalidateDashboardCache } = require("../middleware/cache");
const cacheService = require("../services/cache.service");
const AppError = require("../utils/errors/AppError");
const constants = require("../config/constants");
const { jobQueue } = require('../services/queue.service');

const getGoals = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { goalType, status, startDate, endDate, sortBy, sortOrder } = req.query;
    const userId = req.user._id;
    
    const query = { userId };
    if (goalType) query.goalType = goalType;
    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    }
    if (startDate) query.startDate = { $gte: new Date(startDate) };
    if (endDate) query.endDate = { $lte: new Date(endDate) };
    
    const sort = {};
    sort[sortBy || "startDate"] = sortOrder === "asc" ? 1 : -1;
    
    const [goals, total] = await Promise.all([
      Goal.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('targetQuestions', '_id title platformQuestionId platform difficulty')
        .lean(),
      Goal.countDocuments(query)
    ]);
    
    res.json(formatResponse("Goals retrieved successfully", { goals }, { pagination: paginate(total, page, limit) }));
  } catch (error) {
    next(error);
  }
};

const getCurrentGoals = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const timeZone = req.userTimeZone; 
    let dateParam = req.query.date ? new Date(req.query.date) : new Date();

    const dailyStart = getStartOfDay(dateParam, timeZone);
    const dailyEnd = getEndOfDay(dateParam, timeZone);

    const dailyGoal = await Goal.findOne({
      userId,
      goalType: "daily",
      startDate: { $lte: dailyEnd },
      endDate: { $gte: dailyStart },
      status: "active"
    }).lean();

    const weeklyStart = getStartOfWeek(dateParam, timeZone);
    const weeklyEnd = getEndOfWeek(dateParam, timeZone);

    const weeklyGoal = await Goal.findOne({
      userId,
      goalType: "weekly",
      startDate: { $lte: weeklyEnd },
      endDate: { $gte: weeklyStart },
      status: "active"
    }).lean();

    const stats = {
      dailyProgress: dailyGoal?.completedCount || 0,
      dailyTarget: dailyGoal?.targetCount || 0,
      dailyRemaining: dailyGoal ? Math.max(0, dailyGoal.targetCount - dailyGoal.completedCount) : 0,
      weeklyProgress: weeklyGoal?.completedCount || 0,
      weeklyTarget: weeklyGoal?.targetCount || 0,
      weeklyRemaining: weeklyGoal ? Math.max(0, weeklyGoal.targetCount - weeklyGoal.completedCount) : 0,
      dailyCompletion: dailyGoal?.completionPercentage || 0,
      weeklyCompletion: weeklyGoal?.completionPercentage || 0
    };

    res.json(formatResponse("Current goals retrieved", { currentGoals: { daily: dailyGoal, weekly: weeklyGoal }, stats }));
  } catch (error) {
    next(error);
  }
};

const getGoalById = async (req, res, next) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('targetQuestions', '_id title platformQuestionId platform difficulty')
      .lean();
    if (!goal) throw new AppError("Goal not found", 404);
    res.json(formatResponse("Goal retrieved successfully", { goal }));
  } catch (error) {
    next(error);
  }
};

const createGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { goalType, targetCount, startDate, endDate } = req.body;
    const timeZone = req.userTimeZone;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const todayStart = getStartOfDay(new Date(), timeZone);
    if (start < todayStart) {
      throw new AppError("Start date cannot be in the past", 400);
    }
    
    if (end <= start) throw new AppError("End date must be after start date", 400);
    
    const existingGoal = await Goal.findOne({
      userId,
      goalType,
      startDate: { $lte: end },
      endDate: { $gte: start },
      status: "active"
    });
    
    if (existingGoal) throw new AppError("Goal already exists for this period", 409);
    
    const goal = await Goal.create({
      userId,
      goalType,
      targetCount,
      startDate: start,
      endDate: end,
      completedCount: 0,
      status: "active"
    });
    
    await invalidateCache(`goals:*:user:${userId}:*`);
    await invalidateDashboardCache(userId);
    res.status(201).json(formatResponse("Goal created successfully", { goal }));
  } catch (error) {
    next(error);
  }
};

const updateGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const goalId = req.params.id;
    const updates = req.body;
    
    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) throw new AppError("Goal not found", 404);
    if (goal.status !== "active") throw new AppError("Cannot update a non‑active goal", 400);
    
    if (updates.startDate || updates.endDate) {
      if (goal.status === "completed") throw new AppError("Cannot update completed goal", 400);
    }
    
    const updatedGoal = await Goal.findOneAndUpdate(
      { _id: goalId, userId },
      updates,
      { new: true, runValidators: true }
    );
    
    if (!updatedGoal) throw new AppError("Goal not found", 404);
    
    await invalidateCache(`goals:*:user:${userId}:*`);
    await cacheService.del(`goal:${goalId}`);
    await invalidateDashboardCache(userId);
    
    res.json(formatResponse("Goal updated successfully", { goal: updatedGoal }));
  } catch (error) {
    next(error);
  }
};

const incrementGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const goalId = req.params.id;
    const amount = req.body.amount || 1;
    
    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) throw new AppError("Goal not found", 404);
    if (goal.status !== "active") throw new AppError("Cannot update non-active goal", 400);
    
    goal.completedCount += amount;
    if (goal.completedCount > goal.targetCount) goal.completedCount = goal.targetCount;
    
    await goal.save();
    
    await jobQueue.add('goal.completed', {
      userId,
      goalId: goal._id,
      completedAt: goal.achievedAt || new Date(),
      goalType: goal.goalType,
      targetCount: goal.targetCount,
      completedCount: goal.completedCount
    });
    
    await invalidateCache(`goals:*:user:${userId}:*`);
    await cacheService.del(`goal:${goalId}`);
    await invalidateDashboardCache(userId);
    
    res.json(formatResponse("Goal progress updated", { goal }));
  } catch (error) {
    next(error);
  }
};

const decrementGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const goalId = req.params.id;
    const amount = req.body.amount || 1;
    
    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) throw new AppError("Goal not found", 404);
    if (goal.status !== "active") throw new AppError("Cannot update non-active goal", 400);
    if (goal.completedCount - amount < 0) throw new AppError("Cannot decrement below 0", 400);
    
    goal.completedCount -= amount;
    if (goal.status === "completed") goal.status = "active";
    if (goal.status === "failed") goal.status = "active";
    goal.achievedAt = undefined;
    
    await goal.save();
    
    await invalidateCache(`goals:*:user:${userId}:*`);
    await cacheService.del(`goal:${goalId}`);
    await invalidateDashboardCache(userId);
    
    res.json(formatResponse("Goal progress updated", { goal }));
  } catch (error) {
    next(error);
  }
};

const setGoalProgress = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const goalId = req.params.id;
    const { completedCount } = req.body;
    
    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) throw new AppError("Goal not found", 404);
    if (goal.status !== "active") throw new AppError("Cannot update non-active goal", 400);
    if (completedCount > goal.targetCount) throw new AppError("Completed count cannot exceed target count", 400);
    
    goal.completedCount = completedCount;
    await goal.save();
    
    await invalidateCache(`goals:*:user:${userId}:*`);
    await cacheService.del(`goal:${goalId}`);
    await invalidateDashboardCache(userId);
    
    res.json(formatResponse("Goal progress updated", { goal }));
  } catch (error) {
    next(error);
  }
};

const autoCreateGoals = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const timeZone = req.userTimeZone; 
    let dateParam = req.query.date ? new Date(req.query.date) : new Date();
    const goalType = req.query.goalType;
    
    const user = await User.findById(userId).select("preferences");
    const created = [];
    
    const createGoalIfNotExists = async (type, start, end) => {
      const existing = await Goal.findOne({
        userId,
        goalType: type,
        startDate: { $lte: end },
        endDate: { $gte: start },
        status: "active"
      });
      
      if (!existing) {
        const target = type === "daily" 
          ? (user.preferences?.dailyGoalTarget || constants.DEFAULT_DAILY_GOAL)
          : (user.preferences?.weeklyGoalTarget || constants.DEFAULT_WEEKLY_GOAL);
        
        const goal = await Goal.create({
          userId,
          goalType: type,
          targetCount: target,
          startDate: start,
          endDate: end,
          completedCount: 0,
          status: "active"
        });
        
        created.push({
          goalType: type,
          targetCount: goal.targetCount,
          startDate: goal.startDate,
          endDate: goal.endDate
        });
        
        return goal;
      }
      return existing;
    };
    
    if (!goalType || goalType === "daily") {
      const start = getStartOfDay(dateParam, timeZone);
      const end = getEndOfDay(dateParam, timeZone);
      await createGoalIfNotExists("daily", start, end);
    }
    
    if (!goalType || goalType === "weekly") {
      const start = getStartOfWeek(dateParam, timeZone);
      const end = getEndOfWeek(dateParam, timeZone);
      await createGoalIfNotExists("weekly", start, end);
    }
    
    await invalidateCache(`goals:*:user:${userId}:*`);
    await invalidateDashboardCache(userId);
    
    res.status(201).json(formatResponse("Goals created successfully", { created }));
  } catch (error) {
    next(error);
  }
};

const deleteGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const goalId = req.params.id;
    
    const goal = await Goal.findOneAndDelete({ _id: goalId, userId });
    if (!goal) throw new AppError("Goal not found", 404);
    
    await invalidateCache(`goals:*:user:${userId}:*`);
    await cacheService.del(`goal:${goalId}`);
    await invalidateDashboardCache(userId);
    
    res.json(formatResponse("Goal deleted successfully"));
  } catch (error) {
    next(error);
  }
};

const getGoalStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate, goalType } = req.query;
    
    const query = { userId };
    if (goalType) query.goalType = goalType;
    if (startDate) query.startDate = { $gte: new Date(startDate) };
    if (endDate) query.endDate = { $lte: new Date(endDate) };
    
    const goals = await Goal.find(query).lean();
    
    const stats = {
      totalGoals: goals.length,
      completed: goals.filter(g => g.status === "completed").length,
      failed: goals.filter(g => g.status === "failed").length,
      active: goals.filter(g => g.status === "active").length,
      completionRate: goals.length > 0 ? Math.round((goals.filter(g => g.status === "completed").length / goals.length) * 100) : 0,
      averageCompletion: goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.completionPercentage, 0) / goals.length) : 0
    };
    
    const dailyGoals = goals.filter(g => g.goalType === "daily");
    const weeklyGoals = goals.filter(g => g.goalType === "weekly");
    
    stats.byGoalType = {
      daily: {
        total: dailyGoals.length,
        completed: dailyGoals.filter(g => g.status === "completed").length,
        completionRate: dailyGoals.length > 0 ? Math.round((dailyGoals.filter(g => g.status === "completed").length / dailyGoals.length) * 100) : 0
      },
      weekly: {
        total: weeklyGoals.length,
        completed: weeklyGoals.filter(g => g.status === "completed").length,
        completionRate: weeklyGoals.length > 0 ? Math.round((weeklyGoals.filter(g => g.status === "completed").length / weeklyGoals.length) * 100) : 0
      }
    };
    
    const completedDailyGoals = dailyGoals.filter(g => g.status === "completed").sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate = null;
    
    for (const goal of completedDailyGoals) {
      const goalDate = formatDate(goal.endDate);
      if (!lastDate || getDaysBetween(new Date(lastDate), new Date(goalDate)) === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
      lastDate = goalDate;
    }
    
    currentStreak = tempStreak;
    
    stats.streak = {
      current: currentStreak,
      longest: longestStreak
    };
    
    res.json(formatResponse("Goal statistics retrieved", { stats }));
  } catch (error) {
    next(error);
  }
};

const getGoalHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { period, from, to, goalType, page = 1, limit = 20 } = req.query;
    
    let startDate, endDate;
    
    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
    } else if (period && period.match(/^\d{2}-\d{4}$/)) {
      const [month, year] = period.split("-").map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
    } else if (period && period.match(/^\d{4}$/)) {
      const year = Number(period);
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    }
    
    const query = { 
      userId, 
      startDate: { $gte: startDate, $lte: endDate } 
    };
    if (goalType) query.goalType = goalType;
    
    const skip = (page - 1) * limit;
    
    const [goals, total] = await Promise.all([
      Goal.find(query).sort({ startDate: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      Goal.countDocuments(query)
    ]);
    
    const historyMap = new Map();
    
    goals.forEach(goal => {
      let periodKey;
      if (goal.goalType === "daily") {
        periodKey = formatDate(goal.startDate);
      } else {
        const weekStart = getStartOfWeek(goal.startDate);
        periodKey = formatDate(weekStart);
      }
      
      if (!historyMap.has(periodKey)) {
        historyMap.set(periodKey, {
          period: periodKey,
          goalType: goal.goalType,
          totalGoals: 0,
          completed: 0,
          completionRate: 0,
          averageCompletion: 0,
          completionSum: 0
        });
      }
      
      const entry = historyMap.get(periodKey);
      entry.totalGoals++;
      if (goal.status === "completed") entry.completed++;
      entry.completionSum += goal.completionPercentage;
    });
    
    const history = Array.from(historyMap.values()).map(entry => ({
      period: entry.period,
      goalType: entry.goalType,
      totalGoals: entry.totalGoals,
      completed: entry.completed,
      completionRate: entry.totalGoals > 0 ? Math.round((entry.completed / entry.totalGoals) * 100) : 0,
      averageCompletion: entry.totalGoals > 0 ? Math.round(entry.completionSum / entry.totalGoals) : 0
    })).sort((a, b) => a.period.localeCompare(b.period));
    
    let completionRateTrend = 0;
    let averageCompletionTrend = 0;
    
    if (history.length >= 2) {
      const recent = history[history.length - 1];
      const previous = history[history.length - 2];
      completionRateTrend = recent.completionRate - previous.completionRate;
      averageCompletionTrend = recent.averageCompletion - previous.averageCompletion;
    }
    
    const trends = {
      completionRateTrend,
      averageCompletionTrend,
      streakTrend: 0
    };
    
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;
    
    res.json(formatResponse("Goal history retrieved", { 
      history, 
      trends,
      dateRange: {
        from: formatDate(startDate),
        to: formatDate(endDate)
      }
    }, {
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: totalPages,
        hasNext,
        hasPrev
      }
    }));
  } catch (error) {
    next(error);
  }
};

const createPlannedGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { questionIds, timeframe, startDate, endDate } = req.body;
    const timeZone = req.userTimeZone;

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      throw new AppError('At least one question ID is required', 400);
    }

    const Question = require("../models/Question");
    const questions = await Question.find({ _id: { $in: questionIds }, isActive: true }).select("_id title platformQuestionId platform difficulty");
    if (questions.length !== questionIds.length) {
      throw new AppError("One or more question IDs are invalid or inactive", 400);
    }

    let goalStartDate, goalEndDate;

    if (startDate && endDate) {
      goalStartDate = new Date(startDate);
      goalEndDate = new Date(endDate);
      if (isNaN(goalStartDate.getTime()) || isNaN(goalEndDate.getTime())) {
        throw new AppError("Invalid startDate or endDate format", 400);
      }
      if (goalEndDate <= goalStartDate) {
        throw new AppError("End date must be after start date", 400);
      }
      
      const now = new Date();
      const todayStart = getStartOfDay(now, timeZone);
      if (goalEndDate < todayStart) {
        throw new AppError("End date cannot be in the past", 400);
      }
    } else if (timeframe) {
      const { getDateRangeFromTimeframe } = require("../services/timeframe.service");
      const range = getDateRangeFromTimeframe(timeframe, timeZone);
      goalStartDate = range.startDate;
      goalEndDate = range.endDate;
    } else {
      throw new AppError("Either timeframe or startDate/endDate must be provided", 400);
    }

    const todayStart = getStartOfDay(new Date(), timeZone);
    if (goalStartDate < todayStart) {
      throw new AppError("Start date cannot be in the past", 400);
    }

    const overlappingGoals = await Goal.find({
      userId,
      goalType: "planned",
      status: "active",
      startDate: { $lte: goalEndDate },
      endDate: { $gte: goalStartDate },
      targetQuestions: { $in: questionIds },
    }).lean();

    if (overlappingGoals.length > 0) {
      const conflictingQuestionIds = overlappingGoals.flatMap((g) => g.targetQuestions);
      const conflictSet = new Set(conflictingQuestionIds.map((id) => id.toString()));
      const conflicting = questionIds.filter((id) => conflictSet.has(id.toString()));
      throw new AppError(
        `Question(s) ${conflicting.join(", ")} already belong to another active planned goal in the same time period`,
        409
      );
    }

    const goal = await Goal.create({
      userId,
      goalType: "planned",
      targetCount: questionIds.length,
      targetQuestions: questionIds,
      completedQuestions: [],
      startDate: goalStartDate,
      endDate: goalEndDate,
      status: "active",
    });

    await goal.populate('targetQuestions', '_id title platformQuestionId platform difficulty');

    await invalidateCache(`goals:*:user:${userId}:*`);
    await invalidateDashboardCache(userId);
    res.status(201).json(formatResponse("Planned goal created successfully", { goal }));
  } catch (error) {
    next(error);
  }
};

const getPlannedGoals = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status } = req.query;
    const query = { userId: req.user._id, goalType: "planned" };
    
    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    }
    
    const sort = { startDate: -1 };
    const [goals, total] = await Promise.all([
      Goal.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('targetQuestions', '_id title platformQuestionId platform difficulty')
        .lean(),
      Goal.countDocuments(query),
    ]);

    res.json(
      formatResponse("Planned goals retrieved", { goals }, { pagination: paginate(total, page, limit) })
    );
  } catch (error) {
    next(error);
  }
};

const deletePlannedGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const goalId = req.params.id;
    const goal = await Goal.findOneAndDelete({ _id: goalId, userId, goalType: "planned" });
    if (!goal) throw new AppError("Planned goal not found", 404);
    await invalidateCache(`goals:*:user:${userId}:*`);
    await invalidateDashboardCache(userId);
    res.json(formatResponse("Planned goal deleted successfully"));
  } catch (error) {
    next(error);
  }
};

const copyGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const goalId = req.params.id;
    const { timeframe, startDate, endDate } = req.body;
    const timeZone = req.userTimeZone;

    const originalGoal = await Goal.findOne({ _id: goalId, userId });
    if (!originalGoal) {
      throw new AppError('Goal not found', 404);
    }

    let newStartDate, newEndDate;
    if (startDate && endDate) {
      newStartDate = new Date(startDate);
      newEndDate = new Date(endDate);
      if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
        throw new AppError('Invalid startDate or endDate', 400);
      }
      if (newEndDate <= newStartDate) {
        throw new AppError('End date must be after start date', 400);
      }
    } else if (timeframe) {
      const { getDateRangeFromTimeframe } = require('../services/timeframe.service');
      const range = getDateRangeFromTimeframe(timeframe, timeZone);
      newStartDate = range.startDate;
      newEndDate = range.endDate;
    } else {
      throw new AppError('Either timeframe or startDate/endDate must be provided', 400);
    }

    if (newStartDate < getStartOfDay(new Date(), timeZone)) {
      throw new AppError("Start date cannot be in the past", 400);
    }

    let newGoalData = {
      userId,
      goalType: originalGoal.goalType,
      startDate: newStartDate,
      endDate: newEndDate,
      status: 'active',
      completedCount: 0,
      completedQuestions: [],
    };

    if (originalGoal.goalType === 'planned') {
      newGoalData.targetQuestions = originalGoal.targetQuestions;
      newGoalData.targetCount = originalGoal.targetQuestions.length;
    } else {
      newGoalData.targetCount = originalGoal.targetCount;
    }

    if (originalGoal.goalType === 'planned') {
      const overlapping = await Goal.findOne({
        userId,
        goalType: 'planned',
        status: 'active',
        startDate: { $lte: newEndDate },
        endDate: { $gte: newStartDate },
        targetQuestions: { $in: originalGoal.targetQuestions },
      });
      if (overlapping) {
        throw new AppError(
          'One or more questions already belong to another active planned goal in the new time period',
          409
        );
      }
    } else {
      const existing = await Goal.findOne({
        userId,
        goalType: originalGoal.goalType,
        startDate: { $lte: newEndDate },
        endDate: { $gte: newStartDate },
        status: 'active',
      });
      if (existing) {
        throw new AppError(
          `You already have an active ${originalGoal.goalType} goal in the selected period`,
          409
        );
      }
    }

    const newGoal = await Goal.create(newGoalData);
    
    if (newGoal.goalType === 'planned') {
      await newGoal.populate('targetQuestions', '_id title platformQuestionId platform difficulty');
    }
    
    await invalidateCache(`goals:*:user:${userId}:*`);
    await invalidateDashboardCache(userId);
    res.status(201).json(formatResponse('Goal copied successfully', { goal: newGoal }));
  } catch (error) {
    next(error);
  }
};

const getDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

module.exports = {
  getGoals,
  getCurrentGoals,
  getGoalById,
  createGoal,
  updateGoal,
  incrementGoal,
  decrementGoal,
  setGoalProgress,
  autoCreateGoals,
  deleteGoal,
  getGoalStats,
  getGoalHistory,
  createPlannedGoal,
  getPlannedGoals,
  deletePlannedGoal,
  copyGoal,
};