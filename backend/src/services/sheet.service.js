const mongoose = require('mongoose');
const { slugify } = require('../utils/helpers/string');
const config = require('../config');
const Sheet = require('../models/Sheet');
const SheetMembership = require('../models/SheetMembership');
const SheetProgress = require('../models/SheetProgress');
const SheetBookmark = require('../models/SheetBookmark');
const Question = require('../models/Question');
const User = require('../models/User');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const RevisionSchedule = require('../models/RevisionSchedule');
const AppError = require('../utils/errors/AppError');
const { invalidateCache } = require('../middleware/cache');

class SheetService {

  /**
   * Resolve question identifiers, returning successfully resolved IDs and a list of unresolved ones.
   * Does not throw on unresolved identifiers.
   * @param {Array<string>} identifiers
   * @returns {Promise<{ resolvedIds: Array<mongoose.Types.ObjectId>, unresolved: Array<string> }>}
   */
  static async resolveQuestionIdentifiersPartial(identifiers) {
    if (!Array.isArray(identifiers)) {
      return { resolvedIds: [], unresolved: [] };
    }

    const resolvedIds = [];
    const unresolved = [];

    for (const id of identifiers) {
      // Convert to string and trim
      const trimmed = String(id).trim();
      if (!trimmed) continue;

      let found = null;

      // 1. Try ObjectId
      if (mongoose.Types.ObjectId.isValid(trimmed)) {
        const question = await Question.findOne({ _id: trimmed, isActive: true }).select('_id').lean();
        if (question) found = question._id;
      }

      // 2. Try slugified platformQuestionId
      if (!found) {
        const slugified = slugify(trimmed);
        const question = await Question.findOne({ platformQuestionId: slugified, isActive: true }).select('_id').lean();
        if (question) found = question._id;
      }

      // 3. Try exact title match (case‑insensitive)
      if (!found) {
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const question = await Question.findOne({
          title: { $regex: new RegExp(`^${escaped}$`, 'i') },
          isActive: true,
        }).select('_id').lean();
        if (question) found = question._id;
      }

      // 4. Final fallback – text search
      if (!found) {
        const question = await Question.findOne({ $text: { $search: trimmed }, isActive: true })
          .select('_id')
          .lean();
        if (question) found = question._id;
      }

      if (found) {
        resolvedIds.push(found);
      } else {
        unresolved.push(trimmed);
      }
    }

    return { resolvedIds, unresolved };
  }

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

    // 2. Process each search string
    if (searchStrings.length) {
      for (const search of searchStrings) {
        let found = null;

        // Step 2a: Try matching by slugified platformQuestionId
        const slugified = slugify(search);
        const bySlug = await Question.findOne({
          platformQuestionId: slugified,
          isActive: true,
        }).select('_id').lean();
        if (bySlug) found = bySlug._id.toString();

        // Step 2b: If not found, try exact title match (case‑insensitive)
        if (!found) {
          const byTitle = await Question.findOne({
            title: { $regex: new RegExp(`^${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            isActive: true,
          }).select('_id').lean();
          if (byTitle) found = byTitle._id.toString();
        }

        // Step 2c: Final fallback – text search (same as manual tab)
        if (!found) {
          const byText = await Question.findOne({
            $text: { $search: search },
            isActive: true,
          }, { score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .select('_id')
            .lean();
          if (byText) found = byText._id.toString();
        }

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
     * Create a sheet from already‑resolved question IDs (no identifier resolution).
     * Used by async queue handler to separate resolution from creation.
     * @param {string} ownerId
     * @param {string} name
     * @param {string} description
     * @param {Array<string>} questionIds - array of valid ObjectId strings
     * @param {Date|string} targetDate
     * @param {string|null} specialTag
     * @param {string|null} originalSourceName
     * @param {string|null} originalSourceUrl
     * @returns {Promise<Object>} Created sheet
     * @throws {AppError} 409 if sheet with same name already exists for this owner
     */
    static async createSheetWithResolvedIds(ownerId, name, description, questionIds, targetDate, specialTag = null, originalSourceName = null, originalSourceUrl = null) {
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
          name: sheet.name,
          slug: sheet.slug,
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
   * Get a set of sheet IDs that the user has bookmarked.
   * @param {string} userId
   * @returns {Promise<Set<string>>}
   */
  static async _getUserBookmarkedSheetIds(userId) {
    const bookmarks = await SheetBookmark.find({ userId }).select('sheetId').lean();
    return new Set(bookmarks.map(b => b.sheetId.toString()));
  }

  /**
   * Toggle bookmark for a sheet.
   * @param {string} userId
   * @param {string} sheetSlug
   * @returns {Promise<{isBookmarked: boolean, bookmarkCount: number}>}
   */
  static async toggleBookmark(userId, sheetSlug) {
    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true });
    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const existing = await SheetBookmark.findOne({ userId, sheetId: sheet._id });
    let isBookmarked;
    let bookmarkCount;

    if (existing) {
      // Unbookmark
      await existing.deleteOne();
      const updated = await Sheet.findByIdAndUpdate(
        sheet._id,
        { $inc: { bookmarkCount: -1 } },
        { new: true }
      ).select('bookmarkCount').lean();
      bookmarkCount = updated.bookmarkCount;
      isBookmarked = false;
    } else {
      // Bookmark
      await SheetBookmark.create({ userId, sheetId: sheet._id, createdAt: new Date() });
      const updated = await Sheet.findByIdAndUpdate(
        sheet._id,
        { $inc: { bookmarkCount: 1 } },
        { new: true }
      ).select('bookmarkCount').lean();
      bookmarkCount = updated.bookmarkCount;
      isBookmarked = true;
    }

    // Invalidate caches
    await this._invalidateSheetCaches(sheet._id, sheet.slug, userId);
    await invalidateCache(`sheets:bookmarks:user:${userId}:*`);

    return { isBookmarked, bookmarkCount };
  }

  /**
   * Get list of sheets bookmarked by the user, most recent first.
   * @param {string} userId
   * @param {Object} pagination - { page, limit }
   * @param {string|null} search
   * @returns {Promise<Object>}
   */
  static async getBookmarkedSheets(userId, pagination = {}, search = null) {
    let { page = 1, limit = 20 } = pagination;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new AppError('Invalid pagination parameters', 400);
    }
    const skipNum = (pageNum - 1) * limitNum;

    const pipeline = [
      { $match: { userId } },
      { $sort: { createdAt: -1 } },
      { $skip: skipNum },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'sheets',
          localField: 'sheetId',
          foreignField: '_id',
          as: 'sheet',
        },
      },
      { $unwind: '$sheet' },
      { $match: { 'sheet.isActive': true } },
      { $project: { sheet: 1 } }, // keep only sheet field
    ];

    if (search && search.trim()) {
      const searchSlug = slugify(search);
      pipeline.push({
        $match: {
          $or: [
            { 'sheet.slug': { $regex: searchSlug, $options: 'i' } },
            { 'sheet.name': { $regex: search, $options: 'i' } },
            { 'sheet.description': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    const bookmarks = await SheetBookmark.aggregate(pipeline);
    const sheets = bookmarks.map(b => b.sheet);

    // Get total count for pagination
    const countQuery = SheetBookmark.find({ userId });
    if (search && search.trim()) {
      const searchSlug = slugify(search);
      const matchingSheetIds = await Sheet.find({
        isActive: true,
        $or: [
          { slug: { $regex: searchSlug, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      }).distinct('_id');
      countQuery.where('sheetId').in(matchingSheetIds);
    }
    const total = await countQuery.countDocuments();

    // Remove questions from sheets
    sheets.forEach(s => delete s.questions);

    // Fetch participants limited to first 6 per sheet
    const sheetIds = sheets.map(s => s._id);
    const memberships = await SheetMembership.find({ sheetId: { $in: sheetIds } })
      .populate('userId', 'username displayName avatarUrl')
      .sort({ joinedAt: 1 })
      .lean();

    const participantsBySheet = new Map();
    const countBySheet = new Map();
    for (const m of memberships) {
      const sheetIdStr = m.sheetId.toString();
      if (!participantsBySheet.has(sheetIdStr)) participantsBySheet.set(sheetIdStr, []);
      participantsBySheet.get(sheetIdStr).push({
        userId: m.userId._id,
        username: m.userId.username,
        displayName: m.userId.displayName,
        avatarUrl: m.userId.avatarUrl,
      });
      countBySheet.set(sheetIdStr, (countBySheet.get(sheetIdStr) || 0) + 1);
    }

    const limitedParticipants = new Map();
    for (const [sheetId, participants] of participantsBySheet.entries()) {
      limitedParticipants.set(sheetId, participants.slice(0, 6));
    }

    // Owner display names
    const ownerIds = sheets.map(s => s.ownerId).filter(id => id);
    const owners = await User.find({ _id: { $in: ownerIds } }).select('displayName username').lean();
    const ownerMap = new Map();
    for (const owner of owners) ownerMap.set(owner._id.toString(), owner.displayName || owner.username);

    const sheetsWithDetails = sheets.map(s => ({
      _id: s._id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      ownerDisplayName: s.ownerId ? (ownerMap.get(s.ownerId.toString()) || 'Anonymous User') : 'Anonymous User',
      specialTag: s.specialTag,
      originalSourceName: s.originalSourceName,
      originalSourceUrl: s.originalSourceUrl,
      createdAt: s.createdAt,
      bookmarkCount: s.bookmarkCount || 0,
      isBookmarked: true,
      participantCount: countBySheet.get(s._id.toString()) || 0,
      participants: limitedParticipants.get(s._id.toString()) || [],
    }));

    return {
      sheets: sheetsWithDetails,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    };
  }

  /**
   * Get sheet details by slug.
   * @param {string} slug
   * @param {string|null} currentUserId
   * @returns {Promise<Object>}
   */
  static async getSheetBySlug(slug, currentUserId = null, queryOptions = {}) {
    const sheet = await Sheet.findOne({ slug, isActive: true }).lean();
    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    // Pagination defaults
    const page = Math.max(1, parseInt(queryOptions.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryOptions.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Build filter for questions (database level)
    const filter = { _id: { $in: sheet.questions }, isActive: true };
    if (queryOptions.search) {
      const searchRegex = new RegExp(queryOptions.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { platformQuestionId: searchRegex },
      ];
    }
    if (queryOptions.difficulty) {
      const diff = queryOptions.difficulty.charAt(0).toUpperCase() + queryOptions.difficulty.slice(1).toLowerCase();
      filter.difficulty = diff;
    }

    // Get filtered questions with pagination
    let questionsQuery = Question.find(filter).select('_id title problemLink platform platformQuestionId difficulty tags pattern');
    const isPaginationOrFilter = queryOptions.page || queryOptions.limit || queryOptions.search || queryOptions.difficulty;
    if (!isPaginationOrFilter) {
      questionsQuery = questionsQuery.lean();
    } else {
      questionsQuery = questionsQuery.skip(skip).limit(limit).lean();
    }
    let questions = await questionsQuery;

    // Total count of filtered questions (for pagination)
    let totalFiltered = 0;
    if (isPaginationOrFilter) {
      totalFiltered = await Question.countDocuments(filter);
    } else {
      totalFiltered = questions.length;
    }

    // Add tagsSlugs to each question
    questions = questions.map(q => ({
      ...q,
      tagsSlugs: (q.tags || []).map(tag => slugify(tag)),
    }));

    // ========== OPTIMIZED: Get per‑question participant and solved counts via aggregation ==========
    const progressAggregation = await SheetProgress.aggregate([
      { $match: { sheetId: sheet._id } },
      {
        $group: {
          _id: '$questionId',
          participantCount: { $sum: 1 },
          solvedCount: { $sum: { $cond: ['$solved', 1, 0] } },
        },
      },
    ]);

    // Build maps for quick lookup
    const participantCountMap = new Map();
    const solvedCountMap = new Map();
    for (const item of progressAggregation) {
      const qidStr = item._id.toString();
      participantCountMap.set(qidStr, item.participantCount);
      solvedCountMap.set(qidStr, item.solvedCount);
    }

    // Fill the per‑question counts for all questions in the sheet
    const perQuestionParticipantCounts = {};
    const perQuestionSolvedCounts = {};
    for (const qid of sheet.questions) {
      const qidStr = qid.toString();
      perQuestionParticipantCounts[qidStr] = participantCountMap.get(qidStr) || 0;
      perQuestionSolvedCounts[qidStr] = solvedCountMap.get(qidStr) || 0;
    }
    // ========== END OPTIMIZATION ==========

    // Participants list
    const memberships = await SheetMembership.find({ sheetId: sheet._id })
      .populate('userId', 'username avatarUrl displayName')
      .sort({ joinedAt: 1 })
      .lean();

    const participants = memberships.map(m => ({
      userId: m.userId._id,
      username: m.userId.username,
      displayName: m.userId.displayName,
      avatarUrl: m.userId.avatarUrl,
    }));
    const totalParticipants = participants.length;

    // Current user progress (if logged in)
    let currentUserProgress = null;
    if (currentUserId) {
      const membership = memberships.find(m => m.userId._id.toString() === currentUserId.toString());
      if (membership) {
        let progress = await SheetProgress.find({
          sheetId: sheet._id,
          userId: currentUserId,
        }).lean();

        // Apply solveStatus and revisionStatus filters to the progress details
        if (queryOptions.solveStatus === 'solved') {
          progress = progress.filter(p => p.solved === true);
        } else if (queryOptions.solveStatus === 'unsolved') {
          progress = progress.filter(p => p.solved === false);
        }
        if (queryOptions.revisionStatus === 'completed') {
          progress = progress.filter(p => p.revisionCompleted === true);
        } else if (queryOptions.revisionStatus === 'pending') {
          progress = progress.filter(p => p.revisionCompleted === false);
        }

        const solvedCount = progress.filter(p => p.solved).length;
        const revisionCompletedCount = progress.filter(p => p.revisionCompleted).length;
        currentUserProgress = {
          joinedAt: membership.joinedAt,
          targetDate: membership.targetDate,
          completedAt: membership.completedAt,
          solvedCount,
          revisionCompletedCount,
          totalQuestions: sheet.questions.length,
          details: progress.map(p => ({
            questionId: p.questionId,
            solved: p.solved === true,
            revisionCompleted: p.revisionCompleted === true,
          })),
        };
      }
    }

    const hasJoined = !!currentUserProgress;

    // Owner display name
    let ownerDisplayName = 'Anonymous User';
    if (sheet.ownerId) {
      const owner = await User.findById(sheet.ownerId).select('displayName username').lean();
      ownerDisplayName = owner?.displayName || owner?.username || 'Anonymous User';
    }

    // Bookmark status
    let isBookmarked = false;
    if (currentUserId) {
      const bookmark = await SheetBookmark.findOne({ userId: currentUserId, sheetId: sheet._id }).lean();
      isBookmarked = !!bookmark;
    }

    // Prepare pagination metadata (only if pagination/filtering is used)
    let paginationMeta;
    if (isPaginationOrFilter) {
      paginationMeta = {
        page,
        limit,
        total: totalFiltered,
        pages: Math.ceil(totalFiltered / limit),
        hasNext: page < Math.ceil(totalFiltered / limit),
        hasPrev: page > 1,
      };
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
        bookmarkCount: sheet.bookmarkCount || 0,
        isBookmarked,
        totalQuestions: sheet.questions.length,
        createdAt: sheet.createdAt,
        updatedAt: sheet.updatedAt,
      },
      questions,
      participants,
      stats: {
        totalParticipants,
        perQuestionParticipantCounts,
        perQuestionSolvedCounts,
      },
      hasJoined,
      currentUserProgress,
      pagination: paginationMeta,
    };
  }

  /**
   * Get detailed progress of a specific user by username, with pagination, filtering, sorting, and default values.
   * @param {string} sheetSlug
   * @param {string} currentUserId (for access control)
   * @param {string} username
   * @param {Object} queryOptions - { page, limit, search, status, revisionStatus, difficulty, sortBy, sortOrder }
   * @returns {Promise<Object>}
   */
  static async getUserProgress(sheetSlug, currentUserId, username, queryOptions = {}) {
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

    // Pagination defaults
    const page = Math.max(1, parseInt(queryOptions.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryOptions.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Build match conditions for SheetProgress (user and sheet)
    const progressMatch = { sheetId: sheet._id, userId: targetUserId };

    // Apply status filters (solved / revisionCompleted) only for the paginated list, not for overall stats
    if (queryOptions.status === 'solved') {
      progressMatch.solved = true;
    } else if (queryOptions.status === 'unsolved') {
      progressMatch.solved = false;
    }
    if (queryOptions.revisionStatus === 'completed') {
      progressMatch.revisionCompleted = true;
    } else if (queryOptions.revisionStatus === 'pending') {
      progressMatch.revisionCompleted = false;
    }

    // Aggregation pipeline for the paginated list
    const pipeline = [
      { $match: progressMatch },
      {
        $lookup: {
          from: 'questions',
          localField: 'questionId',
          foreignField: '_id',
          as: 'question',
        },
      },
      { $unwind: '$question' },
      { $match: { 'question.isActive': true } },
    ];

    // Apply search filter (title or platformQuestionId)
    if (queryOptions.search) {
      const searchRegex = new RegExp(queryOptions.search, 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'question.title': searchRegex },
            { 'question.platformQuestionId': searchRegex },
          ],
        },
      });
    }

    // Apply difficulty filter
    if (queryOptions.difficulty) {
      const diff = queryOptions.difficulty.charAt(0).toUpperCase() + queryOptions.difficulty.slice(1).toLowerCase();
      pipeline.push({ $match: { 'question.difficulty': diff } });
    }

    // Sorting
    if (queryOptions.sortBy) {
      let sortField;
      const sortOrderValue = queryOptions.sortOrder === 'asc' ? 1 : -1;
      switch (queryOptions.sortBy) {
        case 'title':
          sortField = 'question.title';
          break;
        case 'difficulty':
          sortField = 'question.difficulty';
          break;
        case 'lastUpdated':
          sortField = 'lastUpdated';
          break;
        case 'solved':
          sortField = 'solved';
          break;
        case 'revisionCompleted':
          sortField = 'revisionCompleted';
          break;
        default:
          sortField = 'question.title';
      }
      pipeline.push({ $sort: { [sortField]: sortOrderValue } });
    } else {
      pipeline.push({
        $addFields: {
          originalIndex: { $indexOfArray: [sheet.questions, '$questionId'] },
        },
      });
      pipeline.push({ $sort: { originalIndex: 1 } });
    }

    // Count total documents for pagination (before $skip/$limit)
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    const countResult = await SheetProgress.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Execute main pipeline
    const progressDocs = await SheetProgress.aggregate(pipeline);

    // Transform to desired output format with default values
    const orderedProgress = progressDocs.map(doc => ({
      question: {
        _id: doc.question?._id || null,
        title: doc.question?.title || '',
        problemLink: doc.question?.problemLink || '',
        platform: doc.question?.platform || '',
        platformQuestionId: doc.question?.platformQuestionId || '',
        difficulty: doc.question?.difficulty || '',
        tags: doc.question?.tags || [],
        pattern: doc.question?.pattern || [],
      },
      solved: doc.solved === true,
      revisionCompleted: doc.revisionCompleted === true,
      lastUpdated: doc.lastUpdated || null,
    }));

    // ========== OPTIMIZED: Compute overall stats ==========
    const overallStats = await SheetProgress.aggregate([
      { $match: { sheetId: sheet._id, userId: targetUserId } },
      {
        $group: {
          _id: null,
          solvedCount: { $sum: { $cond: ['$solved', 1, 0] } },
          revisionCompletedCount: { $sum: { $cond: ['$revisionCompleted', 1, 0] } },
        },
      },
    ]);
    const solvedCount = overallStats[0]?.solvedCount || 0;
    const revisionCompletedCount = overallStats[0]?.revisionCompletedCount || 0;
    const totalQuestions = sheet.questions.length;
    const isFullyCompleted = solvedCount === totalQuestions && revisionCompletedCount === totalQuestions;
    // ========== END OPTIMIZATION ==========

    const shareLink = `${config.frontendUrl}/sheets/${sheetSlug}/progress/${username}`;

    // Pagination metadata
    const totalPages = Math.max(1, Math.ceil(total / limit)) || 1;
    const paginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return {
      userId: targetUserId,
      joinedAt: membership.joinedAt || null,
      targetDate: membership.targetDate || null,
      completedAt: membership.completedAt || null,
      isFullyCompleted: isFullyCompleted || false,
      progress: orderedProgress || [],
      stats: {
        solvedCount: solvedCount || 0,
        revisionCompletedCount: revisionCompletedCount || 0,
        totalQuestions: totalQuestions || 0,
        completionPercentage: totalQuestions
          ? ((solvedCount + revisionCompletedCount) / (totalQuestions * 2)) * 100
          : 0,
      },
      shareLink: shareLink || '',
      pagination: paginationMeta,
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
    const progressData = await this.getUserProgress(sheetSlug, currentUserId, username, {});
    const { stats } = progressData;
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
   * Default sorting: by bookmarkCount desc, then createdAt desc.
   * @param {Object} filters - { search, ownerId, sortBy, sortOrder, mySheets }
   * @param {Object} pagination - { page, limit }
   * @param {string|null} currentUserId - required if mySheets=true
   * @param {boolean} _fallbackAttempted - internal flag to prevent infinite recursion
   * @returns {Promise<Object>}
   */
  static async getSheetsList(filters = {}, pagination = {}, currentUserId = null, _fallbackAttempted = false) {
    const { search, ownerId, sortBy, sortOrder = 'desc', mySheets = false } = filters;
    let { page = 1, limit = 20 } = pagination;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new AppError('Invalid pagination parameters', 400);
    }
    const skipNum = (pageNum - 1) * limitNum;

    // ----- Normal (non-mySheets) case -----
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

      // Build sort object
      let sort = {};
      if (sortBy === 'bookmarkCount') {
        sort = { bookmarkCount: sortOrder === 'asc' ? 1 : -1 };
      } else if (sortBy === 'createdAt') {
        sort = { createdAt: sortOrder === 'asc' ? 1 : -1 };
      } else if (sortBy === 'name') {
        sort = { name: sortOrder === 'asc' ? 1 : -1 };
      } else if (sortBy === 'updatedAt') {
        sort = { updatedAt: sortOrder === 'asc' ? 1 : -1 };
      } else {
        sort = { bookmarkCount: -1, createdAt: -1 };
      }

      // Exclude the 'questions' field
      const [sheets, total] = await Promise.all([
        Sheet.find(match).sort(sort).skip(skipNum).limit(limitNum).select('-questions').lean(),
        Sheet.countDocuments(match),
      ]);

      // ---------- FALLBACK SORTING (only on first page, empty result, bookmarkCount sort, no search, no mySheets) ----------
      if (!_fallbackAttempted && pageNum === 1 && sheets.length === 0 && total === 0 && sortBy === 'bookmarkCount' && !search && !mySheets) {
        // Retry with sorting by createdAt desc (most recent first)
        return this.getSheetsList(
          { ...filters, sortBy: 'createdAt', sortOrder: 'desc' },
          pagination,
          currentUserId,
          true // prevent further recursion
        );
      }
      // ----------------------------------------------------------------------------------------------------------------

      const sheetIds = sheets.map(s => s._id);

      // Fetch memberships (sorted by join date to get the first participants)
      const memberships = await SheetMembership.find({ sheetId: { $in: sheetIds } })
        .populate('userId', 'username avatarUrl displayName')
        .sort({ joinedAt: 1 }) // oldest first for consistency
        .lean();

      // Group participants by sheet and limit to first 6
      const participantsBySheet = new Map();
      const countBySheet = new Map();
      for (const m of memberships) {
        const sheetIdStr = m.sheetId.toString();
        if (!participantsBySheet.has(sheetIdStr)) participantsBySheet.set(sheetIdStr, []);
        participantsBySheet.get(sheetIdStr).push({
          userId: m.userId._id,
          username: m.userId.username,
          displayName: m.userId.displayName,
          avatarUrl: m.userId.avatarUrl,
        });
        countBySheet.set(sheetIdStr, (countBySheet.get(sheetIdStr) || 0) + 1);
      }

      const limitedParticipants = new Map();
      for (const [sheetId, participants] of participantsBySheet.entries()) {
        limitedParticipants.set(sheetId, participants.slice(0, 6));
      }

      // Fetch owner display names and usernames
      const ownerIds = sheets.map(s => s.ownerId).filter(id => id);
      const owners = await User.find({ _id: { $in: ownerIds } }).select('displayName username').lean();
      const ownerMap = new Map();
      for (const owner of owners) {
        ownerMap.set(owner._id.toString(), {
          displayName: owner.displayName || owner.username,
          username: owner.username,
        });
      }

      // Bookmarked set for current user
      let bookmarkedSet = new Set();
      if (currentUserId) {
        bookmarkedSet = await this._getUserBookmarkedSheetIds(currentUserId);
      }

      const sheetsWithDetails = sheets.map(s => {
        const ownerInfo = s.ownerId ? ownerMap.get(s.ownerId.toString()) : null;
        const ownerDisplayName = ownerInfo?.displayName || 'Anonymous User';
        const ownerUsername = ownerInfo?.username || null;
        return {
          _id: s._id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          ownerDisplayName,
          ownerUsername,
          specialTag: s.specialTag,
          originalSourceName: s.originalSourceName,
          originalSourceUrl: s.originalSourceUrl,
          createdAt: s.createdAt,
          bookmarkCount: s.bookmarkCount || 0,
          isBookmarked: bookmarkedSet.has(s._id.toString()),
          participantCount: countBySheet.get(s._id.toString()) || 0,
          participants: limitedParticipants.get(s._id.toString()) || [],
        };
      });

      return {
        sheets: sheetsWithDetails,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      };
    }

    // ----- mySheets = true -----
    if (!currentUserId) {
      throw new AppError('Authentication required for mySheets filter', 401);
    }

    const pipeline = [
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'sheetmemberships',
          let: { sheetId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$sheetId', '$$sheetId'] }, { $eq: ['$userId', currentUserId] }] } } },
            { $limit: 1 },
          ],
          as: 'userMembership',
        },
      },
      {
        $addFields: {
          isOwner: { $eq: ['$ownerId', currentUserId] },
          hasMembership: { $gt: [{ $size: '$userMembership' }, 0] },
        },
      },
      { $match: { $or: [{ isOwner: true }, { hasMembership: true }] } },
      {
        $lookup: {
          from: 'sheetmemberships',
          localField: '_id',
          foreignField: 'sheetId',
          as: 'allMembers',
        },
      },
      {
        $addFields: {
          participantCount: { $size: '$allMembers' },
        },
      },
      { $project: { questions: 0 } }, // exclude questions
    ];

    if (search) {
      const searchSlug = slugify(search);
      pipeline.push({
        $match: {
          $or: [
            { slug: { $regex: searchSlug, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    // Sorting
    if (sortBy === 'bookmarkCount') {
      pipeline.push({ $sort: { bookmarkCount: sortOrder === 'asc' ? 1 : -1 } });
    } else if (sortBy === 'createdAt') {
      pipeline.push({ $sort: { createdAt: sortOrder === 'asc' ? 1 : -1 } });
    } else if (sortBy === 'name') {
      pipeline.push({ $sort: { name: sortOrder === 'asc' ? 1 : -1 } });
    } else if (sortBy === 'updatedAt') {
      pipeline.push({ $sort: { updatedAt: sortOrder === 'asc' ? 1 : -1 } });
    } else {
      pipeline.push({ $sort: { bookmarkCount: -1, createdAt: -1 } });
    }

    pipeline.push({ $skip: skipNum }, { $limit: limitNum });

    const sheets = await Sheet.aggregate(pipeline);

    // Count pipeline for pagination
    const countPipeline = pipeline.slice(0, -2);
    countPipeline.push({ $count: 'total' });
    const countResult = await Sheet.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    const sheetIds = sheets.map(s => s._id);

    // Fetch participants (limit to first 6 per sheet)
    const memberships = await SheetMembership.find({ sheetId: { $in: sheetIds } })
      .populate('userId', 'username avatarUrl displayName')
      .sort({ joinedAt: 1 })
      .lean();

    const participantsBySheet = new Map();
    const countBySheet = new Map();
    for (const m of memberships) {
      const sheetIdStr = m.sheetId.toString();
      if (!participantsBySheet.has(sheetIdStr)) participantsBySheet.set(sheetIdStr, []);
      participantsBySheet.get(sheetIdStr).push({
        userId: m.userId._id,
        username: m.userId.username,
        displayName: m.userId.displayName,
        avatarUrl: m.userId.avatarUrl,
      });
      countBySheet.set(sheetIdStr, (countBySheet.get(sheetIdStr) || 0) + 1);
    }

    const limitedParticipants = new Map();
    for (const [sheetId, participants] of participantsBySheet.entries()) {
      limitedParticipants.set(sheetId, participants.slice(0, 6));
    }

    // Owner display names and usernames
    const ownerIds = sheets.map(s => s.ownerId).filter(id => id);
    const owners = await User.find({ _id: { $in: ownerIds } }).select('displayName username').lean();
    const ownerMap = new Map();
    for (const owner of owners) {
      ownerMap.set(owner._id.toString(), {
        displayName: owner.displayName || owner.username,
        username: owner.username,
      });
    }

    let bookmarkedSet = new Set();
    if (currentUserId) {
      bookmarkedSet = await this._getUserBookmarkedSheetIds(currentUserId);
    }

    const sheetsWithDetails = sheets.map(s => {
      const ownerInfo = s.ownerId ? ownerMap.get(s.ownerId.toString()) : null;
      const ownerDisplayName = ownerInfo?.displayName || 'Anonymous User';
      const ownerUsername = ownerInfo?.username || null;
      return {
        _id: s._id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        ownerDisplayName,
        ownerUsername,
        specialTag: s.specialTag,
        originalSourceName: s.originalSourceName,
        originalSourceUrl: s.originalSourceUrl,
        createdAt: s.createdAt,
        bookmarkCount: s.bookmarkCount || 0,
        isBookmarked: bookmarkedSet.has(s._id.toString()),
        participantCount: countBySheet.get(s._id.toString()) || 0,
        participants: limitedParticipants.get(s._id.toString()) || [],
      };
    });

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

    await SheetMembership.deleteOne({ sheetId: sheet._id, userId });
    await SheetProgress.deleteMany({ sheetId: sheet._id, userId });

    sheet.ownerId = null;
    await sheet.save();

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
    await invalidateCache(`sheet:${slug}:*`);
    await invalidateCache(`sheet:${sheetId}:*`);
    await invalidateCache('sheets:list:*');
    await invalidateCache(`sheet:/api/v1/sheets/${slug}*`);
    if (userId) {
      await invalidateCache(`sheet:user:${userId}:/api/v1/sheets/${slug}*`);
      await invalidateCache(`user:${userId}:sheets:*`);
      await invalidateCache(`sheets:bookmarks:user:${userId}:*`);
    }
  }

  /**
   * Get aggregated progress chart data for all participants in a sheet.
   * @param {string} sheetSlug
   * @returns {Promise<Object>}
   */
  static async getSheetProgressChartData(sheetSlug) {
    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true }).lean();
    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    // Aggregation pipeline on SheetProgress
    const aggregation = await SheetProgress.aggregate([
      { $match: { sheetId: sheet._id } },
      {
        $group: {
          _id: null,
          totalSolved: { $sum: { $cond: ['$solved', 1, 0] } },
          totalRevisionCompleted: { $sum: { $cond: ['$revisionCompleted', 1, 0] } },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    const stats = aggregation[0] || { totalSolved: 0, totalRevisionCompleted: 0, totalRecords: 0 };
    const totalRecords = stats.totalRecords;
    const totalSolved = stats.totalSolved;
    const totalUnsolved = totalRecords - totalSolved;
    const totalRevisionCompleted = stats.totalRevisionCompleted;
    const totalRevisionPending = totalRecords - totalRevisionCompleted;

    // Optionally compute percentages
    const solvedPercentage = totalRecords ? (totalSolved / totalRecords) * 100 : 0;
    const revisionCompletedPercentage = totalRecords ? (totalRevisionCompleted / totalRecords) * 100 : 0;

    return {
      chart: {
        type: 'polarArea', // can be changed by frontend
        labels: ['Solved', 'Unsolved', 'Revision Completed', 'Revision Pending'],
        datasets: [
          {
            data: [totalSolved, totalUnsolved, totalRevisionCompleted, totalRevisionPending],
          },
        ],
      },
      metadata: {
        totalQuestions: sheet.questions.length,
        totalParticipants: await SheetMembership.countDocuments({ sheetId: sheet._id }),
        totalProgressRecords: totalRecords,
        solvedPercentage: parseFloat(solvedPercentage.toFixed(2)),
        revisionCompletedPercentage: parseFloat(revisionCompletedPercentage.toFixed(2)),
      },
    };
  }

  /**
   * Get top 4 participants and current user's rank for a sheet.
   * @param {string} sheetSlug
   * @param {string|null} currentUserId - can be null for unauthenticated
   * @returns {Promise<Object>}
   */
  static async getSheetRank(sheetSlug, currentUserId) {
    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true }).lean();
    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    // Get top 4 participants (always public)
    const topRankings = await SheetProgress.aggregate([
      { $match: { sheetId: sheet._id } },
      {
        $group: {
          _id: '$userId',
          solvedCount: { $sum: { $cond: ['$solved', 1, 0] } },
          revisionCompletedCount: { $sum: { $cond: ['$revisionCompleted', 1, 0] } },
          lastUpdated: { $max: '$lastUpdated' },
        },
      },
      {
        $sort: {
          solvedCount: -1,
          revisionCompletedCount: -1,
          lastUpdated: 1,
        },
      },
      { $limit: 4 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          username: '$user.username',
          displayName: '$user.displayName',
          avatarUrl: '$user.avatarUrl',
          solvedCount: 1,
          revisionCompletedCount: 1,
        },
      },
    ]);

    const topRanks = topRankings.map((r, idx) => ({ rank: idx + 1, ...r }));

    // If no current user or not logged in, return only top ranks
    if (!currentUserId) {
      return { topRanks, currentUser: null };
    }

    // Check if current user has joined
    const membership = await SheetMembership.findOne({ sheetId: sheet._id, userId: currentUserId }).lean();
    const hasJoined = !!membership;

    let currentUserInfo = null;
    if (hasJoined) {
      const stats = await SheetProgress.aggregate([
        { $match: { sheetId: sheet._id, userId: currentUserId } },
        {
          $group: {
            _id: null,
            solvedCount: { $sum: { $cond: ['$solved', 1, 0] } },
            revisionCompletedCount: { $sum: { $cond: ['$revisionCompleted', 1, 0] } },
          },
        },
      ]);
      const currentUserStats = stats[0] || { solvedCount: 0, revisionCompletedCount: 0 };

      // Count participants with better stats
      const betterCount = await SheetProgress.aggregate([
        { $match: { sheetId: sheet._id, userId: { $ne: currentUserId } } },
        {
          $group: {
            _id: '$userId',
            solvedCount: { $sum: { $cond: ['$solved', 1, 0] } },
            revisionCompletedCount: { $sum: { $cond: ['$revisionCompleted', 1, 0] } },
          },
        },
        {
          $match: {
            $or: [
              { solvedCount: { $gt: currentUserStats.solvedCount } },
              {
                solvedCount: currentUserStats.solvedCount,
                revisionCompletedCount: { $gt: currentUserStats.revisionCompletedCount },
              },
            ],
          },
        },
        { $count: 'count' },
      ]);
      const better = betterCount[0]?.count || 0;
      const currentUserRank = better + 1;

      const user = await User.findById(currentUserId).select('username displayName avatarUrl').lean();
      if (user) {
        currentUserInfo = {
          rank: currentUserRank,
          userId: currentUserId,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          solvedCount: currentUserStats.solvedCount,
          revisionCompletedCount: currentUserStats.revisionCompletedCount,
        };
      }
    }

    return { topRanks, currentUser: currentUserInfo };
  }

  /**
   * Get total count of public sheets.
   * @returns {Promise<number>}
   */
  static async getSheetsCount() {
    return Sheet.countDocuments({ isActive: true });
  }

  /**
   * Get paginated list of participants for a sheet, sorted by rank.
   * @param {string} sheetSlug
   * @param {number} page
   * @param {number} limit
   * @returns {Promise<{participants: Array, pagination: Object}>}
   */
  static async getSheetParticipants(sheetSlug, page = 1, limit = 20) {
    const sheet = await Sheet.findOne({ slug: sheetSlug, isActive: true }).lean();
    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Aggregation pipeline to get participant stats
    const pipeline = [
      { $match: { sheetId: sheet._id } },
      {
        $group: {
          _id: '$userId',
          solvedCount: { $sum: { $cond: ['$solved', 1, 0] } },
          revisionCompletedCount: { $sum: { $cond: ['$revisionCompleted', 1, 0] } },
          lastUpdated: { $max: '$lastUpdated' },
        },
      },
      {
        $sort: {
          solvedCount: -1,
          revisionCompletedCount: -1,
          lastUpdated: 1,
        },
      },
      { $skip: skip },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          username: '$user.username',
          displayName: '$user.displayName',
          avatarUrl: '$user.avatarUrl',
          solvedCount: 1,
          revisionCompletedCount: 1,
        },
      },
    ];

    const participantsData = await SheetProgress.aggregate(pipeline);

    // Get total number of participants for pagination
    const totalParticipants = await SheetProgress.distinct('userId', { sheetId: sheet._id });
    const total = totalParticipants.length;

    // Assign rank numbers
    const participants = participantsData.map((p, index) => ({
      rank: skip + index + 1,
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      totalQuestionsSolved: p.solvedCount,
    }));

    return {
      participants,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }
}

module.exports = SheetService;