const mongoose = require('mongoose');
const { slugify } = require('../utils/helpers/string');
const config = require('../config');
const Sheet = require('../models/Sheet');
const SheetMembership = require('../models/SheetMembership');
const SheetProgress = require('../models/SheetProgress');
const Question = require('../models/Question');
const User = require('../models/User');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const RevisionSchedule = require('../models/RevisionSchedule');
const AppError = require('../utils/errors/AppError');
const { invalidateCache } = require('../middleware/cache');

class SheetService {
  /**
   * Resolve an array of question identifiers (title, platformQuestionId, or ObjectId)
   * into an array of unique MongoDB ObjectIds.
   * @param {Array<string>} identifiers
   * @returns {Promise<Array<mongoose.Types.ObjectId>>}
   * @throws {AppError} if any identifier cannot be resolved
   */
  static async _resolveQuestionIdentifiers(identifiers) {
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      throw new AppError('At least one question identifier is required', 400);
    }

    const resolvedIds = new Set();
    const unresolved = [];

    const objectIdStrings = [];
    const searchStrings = [];

    for (const id of identifiers) {
      const trimmed = id.trim();
      if (mongoose.Types.ObjectId.isValid(trimmed)) {
        objectIdStrings.push(trimmed);
      } else {
        searchStrings.push(trimmed);
      }
    }

    // 1. Direct ObjectId lookup
    if (objectIdStrings.length) {
      const directQuestions = await Question.find({
        _id: { $in: objectIdStrings },
        isActive: true,
      }).select('_id').lean();
      for (const q of directQuestions) {
        resolvedIds.add(q._id.toString());
      }
      const foundIds = new Set(directQuestions.map(q => q._id.toString()));
      for (const oid of objectIdStrings) {
        if (!foundIds.has(oid)) {
          unresolved.push(oid);
        }
      }
    }

    // 2. Search by platformQuestionId or title (case‑insensitive)
    if (searchStrings.length) {
      const searchedQuestions = await Question.find({
        $or: [
          { platformQuestionId: { $in: searchStrings } },
          { title: { $in: searchStrings.map(s => new RegExp(`^${s}$`, 'i')) } },
        ],
        isActive: true,
      }).select('_id platformQuestionId title').lean();

      const platformIdMap = new Map();
      const titleMap = new Map();
      for (const q of searchedQuestions) {
        platformIdMap.set(q.platformQuestionId, q._id.toString());
        titleMap.set(q.title.toLowerCase(), q._id.toString());
      }

      for (const search of searchStrings) {
        let found = platformIdMap.get(search);
        if (!found) found = titleMap.get(search.toLowerCase());
        if (found) {
          resolvedIds.add(found);
        } else {
          unresolved.push(search);
        }
      }
    }

    if (unresolved.length) {
      const error = new AppError(
        `Some questions could not be found: ${unresolved.join(', ')}. Please check the spelling or ensure these problems exist in the database.`,
        400
      );
      error.data = { unresolved };
      throw error;
    }

    return Array.from(resolvedIds).map(id => new mongoose.Types.ObjectId(id));
  }

  /**
   * Create a sheet manually (owner provides question identifiers, target date, and optional metadata).
   * Automatically creates membership for the owner with the given target date.
   * @param {string} ownerId
   * @param {string} name
   * @param {string} description
   * @param {Array<string>} questionIdentifiers
   * @param {Date|string} targetDate
   * @param {string|null} specialTag
   * @param {string|null} originalSourceName
   * @param {string|null} originalSourceUrl
   * @returns {Promise<Object>} Created sheet
   * @throws {AppError} 409 if sheet with same name already exists for this owner
   */
  static async createSheet(ownerId, name, description, questionIdentifiers, targetDate, specialTag = null, originalSourceName = null, originalSourceUrl = null) {
    // Check for existing sheet with same owner and name (case‑insensitive)
    const existingSheet = await Sheet.findOne({
      ownerId,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      isActive: true,
    });
    if (existingSheet) {
      const error = new AppError('Sheet with this name already exists for you', 409);
      error.data = { existingSheetSlug: existingSheet.slug };
      throw error;
    }

    const questionIds = await this._resolveQuestionIdentifiers(questionIdentifiers);

    // Generate unique slug
    let baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;
    while (await Sheet.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const sheet = await Sheet.create({
      ownerId,
      name,
      slug,
      description: description || '',
      questions: questionIds,
      isActive: true,
      specialTag: specialTag || null,
      originalSourceName: originalSourceName || null,
      originalSourceUrl: originalSourceUrl || null,
    });

    // Automatically create owner membership and progress
    await this._initializeOwnerMembership(sheet._id, ownerId, questionIds, targetDate);

    // Invalidate caches
    await this._invalidateSheetCaches(sheet._id, sheet.slug, ownerId);

    return sheet;
  }

  /**
   * Initialize membership and progress for the sheet owner.
   * @param {ObjectId} sheetId
   * @param {ObjectId} ownerId
   * @param {Array<ObjectId>} questionIds
   * @param {Date|string} targetDate
   * @returns {Promise<void>}
   */
  static async _initializeOwnerMembership(sheetId, ownerId, questionIds, targetDate) {
    // Create membership record
    await SheetMembership.create({
      sheetId,
      userId: ownerId,
      targetDate: new Date(targetDate),
      joinedAt: new Date(),
      completedAt: null,
    });

    // Initialize progress rows for the owner
    const progressDocs = [];
    for (const questionId of questionIds) {
      const [questionProgress, revisionSchedule] = await Promise.all([
        UserQuestionProgress.findOne({ userId: ownerId, questionId }).lean(),
        RevisionSchedule.findOne({ userId: ownerId, questionId }).lean(),
      ]);

      const solved = questionProgress && ['Solved', 'Mastered'].includes(questionProgress.status);
      let revisionCompleted = false;
      if (revisionSchedule && revisionSchedule.status === 'completed') {
        revisionCompleted = true;
      } else if (revisionSchedule && revisionSchedule.schedule && revisionSchedule.completedRevisions) {
        revisionCompleted = revisionSchedule.completedRevisions.length === revisionSchedule.schedule.length;
      }

      progressDocs.push({
        sheetId,
        userId: ownerId,
        questionId,
        solved,
        revisionCompleted,
        lastUpdated: new Date(),
      });
    }

    if (progressDocs.length) {
      await SheetProgress.bulkWrite(
        progressDocs.map(doc => ({
          updateOne: {
            filter: { sheetId: doc.sheetId, userId: doc.userId, questionId: doc.questionId },
            update: { $set: doc },
            upsert: true,
          },
        }))
      );
    }

    // Check and update sheet completion for the owner
    await this._checkAndUpdateSheetCompletion(sheetId, ownerId);
  }

  /**
   * Join a sheet (non‑owner participants).
   * @param {string} userId
   * @param {string} sheetSlug
   * @param {Date|string} targetDate
   * @returns {Promise<Object>}
   */
  static async joinSheet(userId, sheetSlug, targetDate) {
    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true });
    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const existingMembership = await SheetMembership.findOne({ sheetId: sheet._id, userId });
    if (existingMembership) {
      const error = new AppError('You are already a member of this sheet. No need to join again.', 409);
      error.data = {
        sheet: {
          // _id: sheet._id,
          name: sheet.name,
          slug: sheet.slug,
          description: sheet.description,
          // ownerId: sheet.ownerId,
          // createdAt: sheet.createdAt,
          // updatedAt: sheet.updatedAt,
        },
      };
      throw error;
    }

    const membership = await SheetMembership.create({
      sheetId: sheet._id,
      userId,
      targetDate: new Date(targetDate),
      joinedAt: new Date(),
      completedAt: null,
    });

    await this._initializeUserProgress(sheet._id, userId, sheet.questions);
    await this._checkAndUpdateSheetCompletion(sheet._id, userId);
    await this._invalidateSheetCaches(sheet._id, sheet.slug, userId);
    return membership;
  }

  /**
   * Initialize SheetProgress rows for a user in a sheet.
   * (Used for non‑owner participants)
   * @param {ObjectId} sheetId
   * @param {ObjectId} userId
   * @param {Array<ObjectId>} questionIds
   * @returns {Promise<void>}
   */
  static async _initializeUserProgress(sheetId, userId, questionIds) {
    const progressDocs = [];

    for (const questionId of questionIds) {
      const [questionProgress, revisionSchedule] = await Promise.all([
        UserQuestionProgress.findOne({ userId, questionId }).lean(),
        RevisionSchedule.findOne({ userId, questionId }).lean(),
      ]);

      const solved = questionProgress && ['Solved', 'Mastered'].includes(questionProgress.status);
      let revisionCompleted = false;
      if (revisionSchedule && revisionSchedule.status === 'completed') {
        revisionCompleted = true;
      } else if (revisionSchedule && revisionSchedule.schedule && revisionSchedule.completedRevisions) {
        revisionCompleted = revisionSchedule.completedRevisions.length === revisionSchedule.schedule.length;
      }

      progressDocs.push({
        sheetId,
        userId,
        questionId,
        solved,
        revisionCompleted,
        lastUpdated: new Date(),
      });
    }

    if (progressDocs.length) {
      await SheetProgress.bulkWrite(
        progressDocs.map(doc => ({
          updateOne: {
            filter: { sheetId: doc.sheetId, userId: doc.userId, questionId: doc.questionId },
            update: { $set: doc },
            upsert: true,
          },
        }))
      );
    }
  }

  /**
   * Update progress when a question is solved.
   * Called from questionSolved queue handler.
   * @param {string} userId
   * @param {string} questionId
   * @returns {Promise<void>}
   */
  static async updateSheetProgressOnSolve(userId, questionId) {
    const sheets = await Sheet.find({ questions: questionId, isActive: true }).lean();
    if (sheets.length === 0) return;

    const sheetIds = sheets.map(s => s._id);
    const memberships = await SheetMembership.find({
      sheetId: { $in: sheetIds },
      userId,
    }).lean();
    if (memberships.length === 0) return;

    const membershipSheetIds = new Set(memberships.map(m => m.sheetId.toString()));
    const targetSheetIds = sheetIds.filter(id => membershipSheetIds.has(id.toString()));

    if (targetSheetIds.length) {
      await SheetProgress.updateMany(
        {
          sheetId: { $in: targetSheetIds },
          userId,
          questionId,
        },
        { $set: { solved: true, lastUpdated: new Date() } }
      );

      for (const sheetId of targetSheetIds) {
        await this._checkAndUpdateSheetCompletion(sheetId, userId);
        const sheet = sheets.find(s => s._id.toString() === sheetId.toString());
        if (sheet) {
          await this._invalidateSheetCaches(sheetId, sheet.slug, userId);
        }
      }
    }
  }

  /**
   * Update progress when a question's revision schedule is fully completed.
   * Called from revisionCompleted queue handler.
   * @param {string} userId
   * @param {string} questionId
   * @returns {Promise<void>}
   */
  static async updateSheetProgressOnRevisionComplete(userId, questionId) {
    const sheets = await Sheet.find({ questions: questionId, isActive: true }).lean();
    if (sheets.length === 0) return;

    const sheetIds = sheets.map(s => s._id);
    const memberships = await SheetMembership.find({
      sheetId: { $in: sheetIds },
      userId,
    }).lean();
    if (memberships.length === 0) return;

    const membershipSheetIds = new Set(memberships.map(m => m.sheetId.toString()));
    const targetSheetIds = sheetIds.filter(id => membershipSheetIds.has(id.toString()));

    if (targetSheetIds.length) {
      await SheetProgress.updateMany(
        {
          sheetId: { $in: targetSheetIds },
          userId,
          questionId,
        },
        { $set: { revisionCompleted: true, lastUpdated: new Date() } }
      );

      for (const sheetId of targetSheetIds) {
        await this._checkAndUpdateSheetCompletion(sheetId, userId);
        const sheet = sheets.find(s => s._id.toString() === sheetId.toString());
        if (sheet) {
          await this._invalidateSheetCaches(sheetId, sheet.slug, userId);
        }
      }
    }
  }

  /**
   * Check if a user has fully completed a sheet (solved and revisionCompleted true for all questions).
   * If yes, update membership.completedAt.
   * @param {ObjectId} sheetId
   * @param {ObjectId} userId
   * @returns {Promise<void>}
   */
  static async _checkAndUpdateSheetCompletion(sheetId, userId) {
    const sheet = await Sheet.findById(sheetId).lean();
    if (!sheet) return;

    const totalQuestions = sheet.questions.length;
    const completedCount = await SheetProgress.countDocuments({
      sheetId,
      userId,
      solved: true,
      revisionCompleted: true,
    });

    if (completedCount === totalQuestions) {
      await SheetMembership.updateOne(
        { sheetId, userId, completedAt: null },
        { $set: { completedAt: new Date() } }
      );
    }
  }

  /**
   * Update current user's target date for a sheet.
   * @param {string} userId
   * @param {string} sheetSlug
   * @param {Date|string} newTargetDate
   * @returns {Promise<Object>}
   */
  static async updateTargetDate(userId, sheetSlug, newTargetDate) {
    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true });
    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const membership = await SheetMembership.findOne({ sheetId: sheet._id, userId });
    if (!membership) {
      throw new AppError('You are not a member of this sheet', 403);
    }

    const newDate = new Date(newTargetDate);
    const currentDate = membership.targetDate;

    if (currentDate.getTime() === newDate.getTime()) {
      throw new AppError('Target date is already set to this value', 400);
    }

    const joinDate = membership.joinedAt;
    if (newDate < joinDate) {
      throw new AppError('Target date cannot be earlier than your join date', 400);
    }

    membership.targetDate = newDate;
    await membership.save();

    await this._invalidateSheetCaches(sheet._id, sheet.slug, userId);

    return {
      sheetId: sheet._id,
      sheetSlug: sheet.slug,
      sheetName: sheet.name,
      targetDate: membership.targetDate,
      joinedAt: membership.joinedAt,
      completedAt: membership.completedAt,
    };
  }

  /**
   * Get sheet details by slug.
   * @param {string} slug
   * @param {string|null} currentUserId
   * @returns {Promise<Object>}
   */
  static async getSheetBySlug(slug, currentUserId = null) {
    const sheet = await Sheet.findOne({ slug, isActive: true }).lean();
    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const questions = await Question.find({
      _id: { $in: sheet.questions },
      isActive: true,
    })
      .select('_id title problemLink platform platformQuestionId difficulty tags pattern')
      .lean();

    const orderedQuestions = sheet.questions
      .map(qid => questions.find(q => q._id.toString() === qid.toString()))
      .filter(Boolean);

    // Tag grouping with deduplication
    const tagToQuestions = new Map();
    for (const q of orderedQuestions) {
      const tags = q.tags && q.tags.length ? q.tags : ['Uncategorized'];
      for (const tag of tags) {
        if (!tagToQuestions.has(tag)) tagToQuestions.set(tag, []);
        tagToQuestions.get(tag).push(q);
      }
    }

    const tagSignature = new Map();
    for (const [tag, qs] of tagToQuestions.entries()) {
      const questionIds = qs.map(q => q._id.toString()).sort();
      const signature = questionIds.join('|');
      tagSignature.set(tag, signature);
    }

    const groups = new Map();
    for (const [tag, signature] of tagSignature.entries()) {
      if (!groups.has(signature)) {
        groups.set(signature, { tags: [], questions: tagToQuestions.get(tag) });
      }
      groups.get(signature).tags.push(tag);
    }

    const tagGroups = Array.from(groups.values()).map(group => ({
      tags: group.tags.sort(),
      questions: group.questions,
    }));

    // Participants list
    const memberships = await SheetMembership.find({ sheetId: sheet._id })
      .populate('userId', 'username avatarUrl displayName')
      .lean();

    const participants = memberships.map(m => ({
      userId: m.userId._id,
      username: m.userId.username,
      displayName: m.userId.displayName,
      avatarUrl: m.userId.avatarUrl,
    }));

    const totalParticipants = participants.length;

    // Per‑question stats
    const perQuestionParticipantCounts = {};
    const perQuestionSolvedCounts = {};

    for (const q of orderedQuestions) {
      const [participantCount, solvedCount] = await Promise.all([
        SheetProgress.countDocuments({ sheetId: sheet._id, questionId: q._id }),
        SheetProgress.countDocuments({ sheetId: sheet._id, questionId: q._id, solved: true }),
      ]);
      perQuestionParticipantCounts[q._id.toString()] = participantCount;
      perQuestionSolvedCounts[q._id.toString()] = solvedCount;
    }

    // Current user progress
    let currentUserProgress = null;
    if (currentUserId) {
      const membership = memberships.find(m => m.userId._id.toString() === currentUserId.toString());
      if (membership) {
        const progress = await SheetProgress.find({
          sheetId: sheet._id,
          userId: currentUserId,
        }).lean();
        const solvedCount = progress.filter(p => p.solved).length;
        const revisionCompletedCount = progress.filter(p => p.revisionCompleted).length;
        currentUserProgress = {
          joinedAt: membership.joinedAt,
          targetDate: membership.targetDate,
          completedAt: membership.completedAt,
          solvedCount,
          revisionCompletedCount,
          totalQuestions: orderedQuestions.length,
          details: progress.map(p => ({
            questionId: p.questionId,
            solved: p.solved === true,
            revisionCompleted: p.revisionCompleted === true,
          })),
        };
      }
    }

    const hasJoined = !!currentUserProgress;

    // Compute owner display name
    let ownerDisplayName = 'Anonymous User';
    if (sheet.ownerId) {
      const owner = await User.findById(sheet.ownerId).select('displayName username').lean();
      ownerDisplayName = owner?.displayName || owner?.username || 'Anonymous User';
    }
    

    return {
      sheet: {
        _id: sheet._id,
        name: sheet.name,
        slug: sheet.slug,
        description: sheet.description,
        ownerId: sheet.ownerId,
        ownerDisplayName,
        shareLink: `${config.frontendUrl}/sheets/${sheet.slug}`,
        specialTag: sheet.specialTag,
        originalSourceName: sheet.originalSourceName,
        originalSourceUrl: sheet.originalSourceUrl,
        createdAt: sheet.createdAt,
        updatedAt: sheet.updatedAt,
      },
      questions: orderedQuestions,
      tagGroups,
      participants,
      stats: {
        totalParticipants,
        perQuestionParticipantCounts,
        perQuestionSolvedCounts,
      },
      hasJoined,
      currentUserProgress,
    };
  }

  /**
   * Get detailed progress of a specific user by username.
   * @param {string} sheetSlug
   * @param {string} currentUserId (for access control)
   * @param {string} username
   * @returns {Promise<Object>}
   */
  static async getUserProgress(sheetSlug, currentUserId, username) {
    const targetUser = await User.findOne({ username }).select('_id').lean();
    if (!targetUser) {
      throw new AppError('User not found', 404);
    }
    const targetUserId = targetUser._id;

    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true }).lean();
    if (!sheet) throw new AppError('Sheet not found', 404);

    const membership = await SheetMembership.findOne({
      sheetId: sheet._id,
      userId: targetUserId,
    }).lean();
    if (!membership) {
      throw new AppError('User has not joined this sheet', 404);
    }

    const progress = await SheetProgress.find({
      sheetId: sheet._id,
      userId: targetUserId,
    }).lean();

    const questions = await Question.find({
      _id: { $in: sheet.questions },
      isActive: true,
    })
      .select('_id title problemLink platform platformQuestionId difficulty tags pattern')
      .lean();

    const orderedProgress = sheet.questions.map(qid => {
      const q = questions.find(qq => qq._id.toString() === qid.toString());
      const prog = progress.find(p => p.questionId.toString() === qid.toString());
      return {
        question: q,
        solved: prog ? (prog.solved === true) : false,
        revisionCompleted: prog ? (prog.revisionCompleted === true) : false,
        lastUpdated: prog ? prog.lastUpdated : null,
      };
    });

    const solvedCount = orderedProgress.filter(p => p.solved).length;
    const revisionCompletedCount = orderedProgress.filter(p => p.revisionCompleted).length;
    const totalQuestions = sheet.questions.length;
    const isFullyCompleted = solvedCount === totalQuestions && revisionCompletedCount === totalQuestions;

    const shareLink = `${config.frontendUrl}/sheets/${sheetSlug}/progress/${username}`;

    return {
      userId: targetUserId,
      joinedAt: membership.joinedAt,
      targetDate: membership.targetDate,
      completedAt: membership.completedAt,
      isFullyCompleted,
      progress: orderedProgress,
      stats: {
        solvedCount,
        revisionCompletedCount,
        totalQuestions,
        completionPercentage: totalQuestions
          ? ((solvedCount + revisionCompletedCount) / (totalQuestions * 2)) * 100
          : 0,
      },
      shareLink,
    };
  }

  /**
   * Get chart‑ready progress data for a user.
   * @param {string} sheetSlug
   * @param {string} currentUserId
   * @param {string} username
   * @returns {Promise<Object>}
   */
  static async getUserProgressChart(sheetSlug, currentUserId, username) {
    const progressData = await this.getUserProgress(sheetSlug, currentUserId, username);
    const { stats, progress } = progressData;
    const totalQuestions = stats.totalQuestions;
    const solvedCount = stats.solvedCount;
    const revisionCompletedCount = stats.revisionCompletedCount;

    return {
      solved: {
        count: solvedCount,
        remaining: totalQuestions - solvedCount,
        percentage: totalQuestions ? (solvedCount / totalQuestions) * 100 : 0,
      },
      revision: {
        completed: revisionCompletedCount,
        remaining: totalQuestions - revisionCompletedCount,
        percentage: totalQuestions ? (revisionCompletedCount / totalQuestions) * 100 : 0,
      },
      totalQuestions,
    };
  }

  /**
   * List sheets with pagination, search, and filtering.
   * Supports mySheets=true to show sheets owned or joined by current user.
   * @param {Object} filters - { search, ownerId, sortBy, sortOrder, mySheets }
   * @param {Object} pagination - { page, limit }
   * @param {string|null} currentUserId - required if mySheets=true
   * @returns {Promise<Object>}
   */
  static async getSheetsList(filters = {}, pagination = {}, currentUserId = null) {
    const { search, ownerId, sortBy = 'createdAt', sortOrder = 'desc', mySheets = false } = filters;
    let { page = 1, limit = 20 } = pagination;

    // Ensure page and limit are numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new AppError('Invalid pagination parameters', 400);
    }
    const skipNum = (pageNum - 1) * limitNum;

    // For normal (non-mySheets) case, keep original find() approach
    if (!mySheets) {
      const match = { isActive: true };
      if (ownerId) match.ownerId = ownerId;
      if (search) {
        const searchSlug = slugify(search);
        match.$or = [
          { slug: { $regex: searchSlug, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }
      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
      const [sheets, total] = await Promise.all([
        Sheet.find(match).sort(sort).skip(skipNum).limit(limitNum).lean(),
        Sheet.countDocuments(match),
      ]);
      const sheetIds = sheets.map(s => s._id);
      const memberships = await SheetMembership.find({ sheetId: { $in: sheetIds } })
        .populate('userId', 'username avatarUrl displayName')
        .lean();
      const membersBySheet = new Map();
      for (const m of memberships) {
        const sheetIdStr = m.sheetId.toString();
        if (!membersBySheet.has(sheetIdStr)) membersBySheet.set(sheetIdStr, []);
        membersBySheet.get(sheetIdStr).push({
          userId: m.userId._id,
          username: m.userId.username,
          displayName: m.userId.displayName,
          avatarUrl: m.userId.avatarUrl,
        });
      }
      const ownerIds = sheets.map(s => s.ownerId).filter(id => id);
      const owners = await User.find({ _id: { $in: ownerIds } }).select('displayName username').lean();
      const ownerMap = new Map();
      for (const owner of owners) ownerMap.set(owner._id.toString(), owner.displayName || owner.username);
      const sheetsWithDetails = sheets.map(s => ({
        ...s,
        ownerDisplayName: s.ownerId ? (ownerMap.get(s.ownerId.toString()) || 'Anonymous User') : 'Anonymous User',
        participantCount: membersBySheet.get(s._id.toString())?.length || 0,
        participants: membersBySheet.get(s._id.toString()) || [],
      }));
      return {
        sheets: sheetsWithDetails,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
      };
    }

    // ---------- mySheets = true ----------
    if (!currentUserId) {
      throw new AppError('Authentication required for mySheets filter', 401);
    }

    // Build aggregation pipeline
    const pipeline = [];

    // 1. Match active sheets
    pipeline.push({ $match: { isActive: true } });

    // 2. Lookup memberships for current user to find sheets they joined
    pipeline.push({
      $lookup: {
        from: 'sheetmemberships',
        let: { sheetId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [ { $eq: ['$sheetId', '$$sheetId'] }, { $eq: ['$userId', currentUserId] } ] } } },
          { $limit: 1 }
        ],
        as: 'userMembership'
      }
    });

    // 3. Add flag: user owns sheet or has membership
    pipeline.push({
      $addFields: {
        isOwner: { $eq: ['$ownerId', currentUserId] },
        hasMembership: { $gt: [{ $size: '$userMembership' }, 0] }
      }
    });

    // 4. Filter: isOwner OR hasMembership
    pipeline.push({ $match: { $or: [{ isOwner: true }, { hasMembership: true }] } });

    // 5. Lookup all memberships to compute participant count
    pipeline.push({
      $lookup: {
        from: 'sheetmemberships',
        localField: '_id',
        foreignField: 'sheetId',
        as: 'allMembers'
      }
    });

    // 6. Add participantCount
    pipeline.push({
      $addFields: {
        participantCount: { $size: '$allMembers' }
      }
    });

    // 7. Apply search if provided
    if (search) {
      const searchSlug = slugify(search);
      pipeline.push({
        $match: {
          $or: [
            { slug: { $regex: searchSlug, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ]
        }
      });
    }

    // 8. Sort by participantCount descending (popularity)
    pipeline.push({ $sort: { participantCount: -1 } });

    // 9. Pagination (use numeric values)
    pipeline.push({ $skip: skipNum });
    pipeline.push({ $limit: limitNum });

    // Execute aggregation
    const sheets = await Sheet.aggregate(pipeline);

    // Get total count for pagination (copy pipeline, remove $skip and $limit, add $count)
    const countPipeline = pipeline.slice(0, -2);
    countPipeline.push({ $count: 'total' });
    const countResult = await Sheet.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Prepare response (similar to normal path)
    const sheetIds = sheets.map(s => s._id);
    // Fetch owner display names
    const ownerIds = sheets.map(s => s.ownerId).filter(id => id);
    const owners = await User.find({ _id: { $in: ownerIds } }).select('displayName username').lean();
    const ownerMap = new Map();
    for (const owner of owners) ownerMap.set(owner._id.toString(), owner.displayName || owner.username);

    // Build participants per sheet (populate user details)
    const memberships = await SheetMembership.find({ sheetId: { $in: sheetIds } })
      .populate('userId', 'username avatarUrl displayName')
      .lean();
    const membersBySheet = new Map();
    for (const m of memberships) {
      const sheetIdStr = m.sheetId.toString();
      if (!membersBySheet.has(sheetIdStr)) membersBySheet.set(sheetIdStr, []);
      membersBySheet.get(sheetIdStr).push({
        userId: m.userId._id,
        username: m.userId.username,
        displayName: m.userId.displayName,
        avatarUrl: m.userId.avatarUrl,
      });
    }

    const sheetsWithDetails = sheets.map(s => ({
      ...s,
      ownerDisplayName: s.ownerId ? (ownerMap.get(s.ownerId.toString()) || 'Anonymous User') : 'Anonymous User',
      participantCount: membersBySheet.get(s._id.toString())?.length || 0,
      participants: membersBySheet.get(s._id.toString()) || [],
      // Remove aggregation helper fields
      userMembership: undefined,
      allMembers: undefined,
      isOwner: undefined,
      hasMembership: undefined,
    }));

    return {
      sheets: sheetsWithDetails,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    };
  }

  /**
   * Leave a sheet: remove membership and all progress records.
   * @param {string} userId
   * @param {string} sheetSlug
   * @returns {Promise<boolean>}
   */
  static async leaveSheet(userId, sheetSlug) {
    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true });
    if (!sheet) throw new AppError('Sheet not found', 404);

    const membership = await SheetMembership.findOneAndDelete({
      sheetId: sheet._id,
      userId,
    });
    if (!membership) throw new AppError('User has not joined this sheet', 404);

    await SheetProgress.deleteMany({ sheetId: sheet._id, userId });
    await this._invalidateSheetCaches(sheet._id, sheet.slug, userId);
    return true;
  }

  /**
   * Update sheet metadata (owner only).
   * @param {string} userId
   * @param {string} sheetSlug
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  static async updateSheet(userId, sheetSlug, updates) {
    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true });
    if (!sheet) throw new AppError('Sheet not found', 404);
    // Allow update only if owner exists and matches the requesting user
    if (!sheet.ownerId || sheet.ownerId.toString() !== userId.toString()) {
      throw new AppError('Only the sheet owner can update it', 403);
    }

    const allowedUpdates = {};
    if (updates.name !== undefined) {
      allowedUpdates.name = updates.name;
      let baseSlug = slugify(updates.name);
      let slug = baseSlug;
      let counter = 1;
      while (await Sheet.findOne({ slug, _id: { $ne: sheet._id } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      allowedUpdates.slug = slug;
    }
    if (updates.description !== undefined) allowedUpdates.description = updates.description;
    if (updates.questions !== undefined) {
      const resolvedIds = await this._resolveQuestionIdentifiers(updates.questions);
      allowedUpdates.questions = resolvedIds;
    }
    // Optional metadata fields
    if (updates.specialTag !== undefined) allowedUpdates.specialTag = updates.specialTag || null;
    if (updates.originalSourceName !== undefined) allowedUpdates.originalSourceName = updates.originalSourceName || null;
    if (updates.originalSourceUrl !== undefined) allowedUpdates.originalSourceUrl = updates.originalSourceUrl || null;

    if (Object.keys(allowedUpdates).length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    const updatedSheet = await Sheet.findByIdAndUpdate(sheet._id, allowedUpdates, { new: true });
    await this._invalidateSheetCaches(sheet._id, sheet.slug);
    return updatedSheet;
  }

  /**
   * Delete sheet (owner removal, soft delete for participants).
   * Owner is removed from membership and progress, ownership is revoked.
   * Sheet remains active for other participants.
   * Returns a warning message for UX.
   * @param {string} userId - Must be the current owner.
   * @param {string} sheetSlug
   * @returns {Promise<Object>} { success: true, warning: string }
   */
  static async deleteSheet(userId, sheetSlug) {
    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true });
    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }
    if (!sheet.ownerId || sheet.ownerId.toString() !== userId.toString()) {
      throw new AppError('Only the sheet owner can delete (remove themselves from) the sheet', 403);
    }

    // Remove owner's membership
    await SheetMembership.deleteOne({ sheetId: sheet._id, userId });

    // Remove owner's progress records
    await SheetProgress.deleteMany({ sheetId: sheet._id, userId });

    // Revoke ownership: set to null
    sheet.ownerId = null;
    await sheet.save();

    // Invalidate caches (force immediate expiry)
    await this._invalidateSheetCaches(sheet._id, sheet.slug, userId);

    const warning = 'You have been removed as the sheet owner. Your progress has been deleted. The sheet remains accessible to other participants. You can rejoin later as a normal participant, but your previous progress will not be restored.';

    return { success: true, warning };
  }

  /**
   * Invalidate all caches related to a sheet, including exact URL patterns.
   * @param {ObjectId} sheetId
   * @param {string} slug
   * @param {string|null} userId - optional, for user-specific caches
   * @returns {Promise<void>}
   */
  static async _invalidateSheetCaches(sheetId, slug, userId = null) {
    // Wildcard patterns for general sheet data
    await invalidateCache(`sheet:${slug}:*`);
    await invalidateCache(`sheet:${sheetId}:*`);
    await invalidateCache('sheets:list:*');

    // Invalidate exact URL-based caches for the single sheet endpoint
    // Public (unauthenticated) cache
    await invalidateCache(`sheet:/api/v1/sheets/${slug}*`);
    // Authenticated user cache
    if (userId) {
      await invalidateCache(`sheet:user:${userId}:/api/v1/sheets/${slug}*`);
      await invalidateCache(`user:${userId}:sheets:*`);
    }
  }
}

module.exports = SheetService;