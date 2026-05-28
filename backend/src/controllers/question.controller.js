const { DateTime } = require('luxon');
const Question = require('../models/Question');
const Goal = require('../models/Goal');
const UserQuestionProgress = require('../models/UserQuestionProgress');
const RevisionSchedule = require('../models/RevisionSchedule');
const CodeExecutionHistory = require('../models/CodeExecutionHistory');
const ActivityLog = require('../models/ActivityLog');
const { formatResponse } = require('../utils/helpers/response');
const { getPaginationParams, paginate } = require('../utils/helpers/pagination');
const { applySorting } = require('../utils/helpers/sort');
const { slugify } = require('../utils/helpers/string');
const { getStartOfDay, getEndOfDay } = require('../utils/helpers/date');
const AppError = require('../utils/errors/AppError');
const { invalidateQuestionCache } = require('../middleware/cache');
const { fetchProblemDetails, searchProblems } = require('../services/leetcode.service');
const { jobQueue } = require('../services/queue.service');
const revisionService = require('../services/revision.service');
const dashboardService = require('../services/dashboard.service');
const leetcodeService = require('../services/leetcode.service');
const patternQuestionService = require('../services/patternQuestion.service');

const toLocalISOString = (utcDate, timeZone) => {
  if (!utcDate) return null;
  if (!timeZone) timeZone = 'UTC';
  const dt = DateTime.fromJSDate(new Date(utcDate), { zone: 'UTC' });
  return dt.setZone(timeZone).toISO({ includeOffset: true });
};

const convertRevisionDatesToLocal = (revision, timeZone) => {
  if (!revision) return revision;
  const converted = { ...revision };
  if (Array.isArray(converted.schedule)) {
    converted.schedule = converted.schedule.map(d => toLocalISOString(d, timeZone));
  }
  if (converted.baseDate) converted.baseDate = toLocalISOString(converted.baseDate, timeZone);
  if (converted.createdAt) converted.createdAt = toLocalISOString(converted.createdAt, timeZone);
  if (converted.updatedAt) converted.updatedAt = toLocalISOString(converted.updatedAt, timeZone);
  if (Array.isArray(converted.completedRevisions)) {
    converted.completedRevisions = converted.completedRevisions.map(cr => ({
      ...cr,
      date: toLocalISOString(cr.date, timeZone),
      completedAt: toLocalISOString(cr.completedAt, timeZone)
    }));
  }
  if (Array.isArray(converted.scheduleStatuses)) {
    converted.scheduleStatuses = converted.scheduleStatuses.map(ss => ({
      ...ss,
      date: toLocalISOString(ss.date, timeZone)
    }));
  }
  return converted;
};

const generatePatternFromTags = (tags) => {
  if (!tags || tags.length === 0) return '';
  const firstTag = tags[0];
  return firstTag.charAt(0).toUpperCase() + firstTag.slice(1);
};

const fetchLeetCodeQuestion = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) throw new AppError('URL is required', 400);
    const details = await fetchProblemDetails(url);
    res.json(formatResponse('Problem fetched from LeetCode', details));
  } catch (error) {
    if (error.code === 'VIP_QUESTION_NOT_ALLOWED') {
      return next(new AppError('VIP questions are not supported', 403));
    }
    next(error);
  }
};

const searchLeetCodeQuestions = async (req, res, next) => {
  try {
    const { q, type = 'name' } = req.query;
    if (!q || q.length < 2) {
      throw new AppError('Search query must be at least 2 characters', 400);
    }
    const results = await searchProblems(q, type);
    res.json(formatResponse('LeetCode search results', { results }));
  } catch (error) {
    next(error);
  }
};

const getQuestions = async (req, res, next) => {
  try {
    // Parse and validate query parameters (with defaults)
    let { page, limit, platform, difficulty, pattern, tags, qtitle, sortBy, sortOrder, status } = req.query;
    page = parseInt(page) || 1;
    limit = Math.min(parseInt(limit) || 20, 100);
    const skip = (page - 1) * limit;

    // Base query: active questions only
    let query = { isActive: true };

    // Platform filter (default is 'LeetCode' from validator)
    if (platform && platform !== 'all') {
      query.platform = platform;
    }

    // Difficulty filter
    if (difficulty && difficulty !== 'all') {
      query.difficulty = difficulty;
    }

    // Pattern filter: resolve slug to pattern name
    if (pattern && pattern !== 'all') {
      const patternName = await patternQuestionService.getPatternNameBySlug(pattern);
      if (!patternName) {
        // Invalid pattern slug – return empty result
        return res.json(formatResponse('Questions retrieved successfully', { questions: [] }, {
          pagination: paginate(0, page, limit)
        }));
      }
      query.pattern = patternName;
    }

    // Tags filter
    if (tags && Array.isArray(tags) && tags.length) {
      query.tags = { $in: tags };
    }

    // Exact title search via slugified platformQuestionId
    if (qtitle) {
      query.platformQuestionId = qtitle;
    }

    // Status filter (solved only)
    let solvedIds = [];
    if (status === 'solved' && req.user) {
      const solvedProgress = await UserQuestionProgress.find({
        userId: req.user._id,
        status: { $in: ['Solved', 'Mastered'] }
      }).select('questionId').lean();
      solvedIds = solvedProgress.map(p => p.questionId);
      if (solvedIds.length === 0) {
        // User has solved zero questions
        return res.json(formatResponse('Questions retrieved successfully', { questions: [] }, {
          pagination: paginate(0, page, limit)
        }));
      }
      query._id = { $in: solvedIds };
    }

    // Build the database query
    let dbQuery = Question.find(query).skip(skip).limit(limit);
    dbQuery = applySorting(dbQuery, { sortBy, sortOrder }, { createdAt: -1 });

    const [questions, total] = await Promise.all([
      dbQuery.lean(),
      Question.countDocuments(query)
    ]);

    // Add user solved status (if logged in)
    let solvedMap = new Map();
    if (req.user && questions.length > 0 && status !== 'solved') {
      const questionIds = questions.map(q => q._id);
      const solvedProgress = await UserQuestionProgress.find({
        userId: req.user._id,
        questionId: { $in: questionIds },
        status: { $in: ['Solved', 'Mastered'] }
      }).select('questionId status').lean();
      solvedMap = new Map(solvedProgress.map(p => [p.questionId.toString(), p.status]));
    }

    const enrichedQuestions = questions.map(q => ({
      ...q,
      isSolved: status === 'solved' ? true : solvedMap.has(q._id.toString()),
      userStatus: status === 'solved' ? 'Solved' : (solvedMap.get(q._id.toString()) || null)
    }));

    res.json(formatResponse('Questions retrieved successfully', { questions: enrichedQuestions }, {
      pagination: paginate(total, page, limit)
    }));
  } catch (error) {
    next(error);
  }
};

const getQuestionById = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).populate('similarQuestions', '_id title platform difficulty pattern').select('-__v');
    if (!question) throw new AppError('Question not found', 404);
    res.json(formatResponse('Question retrieved successfully', { question }));
  } catch (error) { next(error); }
};

const fetchQuestionDetails = async (userId, questionId, timeZone) => {
  const [
    question,
    progress,
    revision,
    codeHistory,
    activityLogs
  ] = await Promise.all([
    Question.findById(questionId)
      .select('title problemLink platform platformQuestionId difficulty tags pattern solutionLinks similarQuestions contentRef testCases starterCode source createdBy isActive')
      .lean(),
    UserQuestionProgress.findOne({ userId, questionId })
      .select('-__v')
      .lean(),
    RevisionSchedule.findOne({ userId, questionId })
      .select('-__v')
      .lean(),
    CodeExecutionHistory.find({ userId, questionId })
      .sort({ executedAt: -1 })
      .limit(10)
      .select('-__v')
      .lean(),
    ActivityLog.find({ userId, targetId: questionId, targetModel: 'Question' })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('-__v')
      .lean()
  ]);

  if (!question) return null;

  // Compute revision count from the revision schedule (source of truth)
  const computedRevisionCount = revision ? revision.completedRevisions.length : 0;

  // If progress exists, override its revisionCount with the computed value
  let updatedProgress = progress ? { ...progress } : null;
  if (updatedProgress) {
    updatedProgress.revisionCount = computedRevisionCount;
  } else if (computedRevisionCount > 0) {
    // If no progress document exists but the user has revisions, create a minimal progress object
    updatedProgress = {
      revisionCount: computedRevisionCount,
      // other fields will be undefined, but the frontend can handle them
    };
  }

  let revisionWithLocalDates = null;
  if (revision) {
    const revObj = {
      ...revision,
      currentStatus: revisionService.getRevisionStatusLabel(revision, null, 'actionable', timeZone),
      scheduleStatuses: revision.schedule.map((date, idx) => ({
        date,
        status: revisionService.getRevisionStatusLabel(revision, idx, 'display', timeZone)
      }))
    };
    revisionWithLocalDates = convertRevisionDatesToLocal(revObj, timeZone);
  }

  return {
    question,
    progress: updatedProgress || null,
    revision: revisionWithLocalDates,
    codeExecutionHistory: codeHistory || [],
    activityLogs: activityLogs || []
  };
};

const getQuestionDetails = async (req, res, next) => {
  try {
    const { id: questionId } = req.params;
    const userId = req.user._id;
    const timeZone = req.userTimeZone || 'UTC';

    const details = await fetchQuestionDetails(userId, questionId, timeZone);
    if (!details) throw new AppError('Question not found', 404);

    res.json(formatResponse('Question details retrieved successfully', details));
  } catch (error) {
    next(error);
  }
};

const getQuestionDetailsByPlatform = async (req, res, next) => {
  try {
    const { platform, platformQuestionId } = req.params;
    const userId = req.user._id;
    const timeZone = req.userTimeZone || 'UTC';

    const question = await Question.findOne({ platform, platformQuestionId, isActive: true })
      .select('_id')
      .lean();
    if (!question) throw new AppError('Question not found', 404);

    const details = await fetchQuestionDetails(userId, question._id, timeZone);
    res.json(formatResponse('Question details retrieved successfully', details));
  } catch (error) {
    next(error);
  }
};

const createQuestion = async (req, res, next) => {
  try {
    const { isManual = false, contentRef, testCases, starterCode, isPaidOnly } = req.body;

    // Block VIP questions
    if (isPaidOnly === true) {
      throw new AppError('VIP questions are not allowed', 403);
    }

    let platformQuestionId = req.body.platformQuestionId;
    if (!platformQuestionId || platformQuestionId.trim() === '') {
      if (!req.body.title) {
        throw new AppError('Title is required to generate question ID', 400);
      }
      const baseSlug = slugify(req.body.title);
      let slug = baseSlug;
      let counter = 1;
      while (await Question.findOne({ platform: req.body.platform, platformQuestionId: slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      platformQuestionId = slug;
      req.body.platformQuestionId = slug;
    }

    const existing = await Question.findOne({ platform: req.body.platform, platformQuestionId: req.body.platformQuestionId });
    if (existing) throw new AppError('Question with same platform and ID already exists', 409);

    let { pattern, tags } = req.body;
    if (!pattern || pattern === '') {
      pattern = generatePatternFromTags(tags || []);
    }
    if (pattern && !Array.isArray(pattern)) {
      req.body.pattern = [pattern];
    } else {
      req.body.pattern = pattern;
    }

    if (isManual) {
      req.body.source = 'manual';
      req.body.createdBy = req.user._id;
      req.body.contentRef = contentRef;
      req.body.testCases = testCases;
    } else {
      req.body.source = 'leetcode';
      req.body.createdBy = null;
    }

    // Create the question without starterCode (to avoid validation errors)
    const questionData = { ...req.body };
    delete questionData.starterCode;
    const question = await Question.create(questionData);

    // For LeetCode questions, fetch the latest starter code snippets
    if (!isManual) {
      try {
        const problemUrl = req.body.problemLink;
        if (problemUrl) {
          const details = await fetchProblemDetails(problemUrl);
          const allowedLanguages = ['cpp', 'c++', 'javascript', 'java', 'python', 'python3'];
          const finalSnippets = {};

          for (const [lang, code] of Object.entries(details.codeSnippets)) {
            const normalizedLang = lang.toLowerCase();
            if (allowedLanguages.includes(normalizedLang)) {
              const targetLang = normalizedLang === 'c++' ? 'cpp' : normalizedLang;
              finalSnippets[targetLang] = code;
            }
          }

          if (starterCode && typeof starterCode === 'object') {
            for (const [lang, code] of Object.entries(starterCode)) {
              const normalizedLang = lang.toLowerCase();
              if (allowedLanguages.includes(normalizedLang)) {
                const targetLang = normalizedLang === 'c++' ? 'cpp' : normalizedLang;
                finalSnippets[targetLang] = code;
              }
            }
          }

          question.starterCode = finalSnippets;
          await question.save();
        }
      } catch (fetchErr) {
        console.error(`[createQuestion] Failed to fetch starter code:`, fetchErr.message);
        if (starterCode && typeof starterCode === 'object') {
          const allowedLanguages = ['cpp', 'c++', 'javascript', 'java', 'python', 'python3'];
          const filteredSnippets = {};
          for (const [lang, code] of Object.entries(starterCode)) {
            const normalizedLang = lang.toLowerCase();
            if (allowedLanguages.includes(normalizedLang)) {
              const targetLang = normalizedLang === 'c++' ? 'cpp' : normalizedLang;
              filteredSnippets[targetLang] = code;
            }
          }
          question.starterCode = filteredSnippets;
          await question.save();
        }
      }
    } else {
      if (starterCode && typeof starterCode === 'object') {
        const allowedLanguages = ['cpp', 'c++', 'javascript', 'java', 'python', 'python3'];
        const filteredSnippets = {};
        for (const [lang, code] of Object.entries(starterCode)) {
          const normalizedLang = lang.toLowerCase();
          if (allowedLanguages.includes(normalizedLang)) {
            const targetLang = normalizedLang === 'c++' ? 'cpp' : normalizedLang;
            filteredSnippets[targetLang] = code;
          }
        }
        question.starterCode = filteredSnippets;
        await question.save();
      }
    }

    if (question.contentRef && (!question.testCases || question.testCases.length === 0)) {
      await jobQueue.add('question.extract_testcases', {
        questionId: question._id
      });
    }

    await invalidateQuestionCache(question._id, question.platform, question.platformQuestionId);

    res.status(201).json(formatResponse('Question created successfully', { question }));
  } catch (error) {
    next(error);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    if (!question) throw new AppError('Question not found', 404);

    if (question.source === 'leetcode') {
      throw new AppError('LeetCode-fetched questions cannot be updated', 403);
    }

    if (question.source === 'manual') {
      if (!question.createdBy || question.createdBy.toString() !== req.user._id.toString()) {
        throw new AppError('Only the creator can update this question', 403);
      }
    }

    const allowedUpdates = {};
    if (req.body.difficulty !== undefined) allowedUpdates.difficulty = req.body.difficulty;
    if (req.body.tags !== undefined) allowedUpdates.tags = req.body.tags;
    if (req.body.pattern !== undefined) allowedUpdates.pattern = req.body.pattern;
    if (req.body.solutionLinks !== undefined) allowedUpdates.solutionLinks = req.body.solutionLinks;
    if (req.body.contentRef !== undefined) allowedUpdates.contentRef = req.body.contentRef;
    if (req.body.testCases !== undefined) allowedUpdates.testCases = req.body.testCases;
    if (req.body.starterCode !== undefined) allowedUpdates.starterCode = req.body.starterCode;

    if (Object.keys(allowedUpdates).length === 0) {
      throw new AppError('No allowed fields to update', 400);
    }

    if (allowedUpdates.pattern !== undefined) {
      let pattern = allowedUpdates.pattern;
      if (!Array.isArray(pattern)) {
        pattern = pattern ? [pattern] : [];
      }
      allowedUpdates.pattern = pattern;
    }

    if (allowedUpdates.starterCode) {
      const allowedLanguages = ['cpp', 'javascript', 'java', 'python', 'python3'];
      const filteredCode = {};
      for (const [lang, code] of Object.entries(allowedUpdates.starterCode)) {
        const normalizedLang = lang.toLowerCase();
        if (allowedLanguages.includes(normalizedLang)) {
          filteredCode[normalizedLang] = code;
        }
      }
      allowedUpdates.starterCode = filteredCode;
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      id,
      allowedUpdates,
      { new: true, runValidators: true }
    ).select('-__v');

    await invalidateQuestionCache(updatedQuestion._id, updatedQuestion.platform, updatedQuestion.platformQuestionId);

    res.json(formatResponse('Question updated successfully', { question: updatedQuestion }));
  } catch (error) {
    next(error);
  }
};

const deleteQuestion = async (req, res, next) => {
  next(new AppError('Delete operation is not allowed', 405));
};

const restoreQuestion = async (req, res, next) => {
  next(new AppError('Restore operation is not allowed', 405));
};

const permanentDeleteQuestion = async (req, res, next) => {
  next(new AppError('Permanent delete operation is not allowed', 405));
};

const getDeletedQuestions = async (req, res, next) => {
  res.json(formatResponse('Deleted questions not supported', { questions: [] }));
};

const getQuestionByPlatformId = async (req, res, next) => {
  try {
    const question = await Question.findOne({ platform: req.params.platform, platformQuestionId: req.params.platformQuestionId, isActive: true }).populate('similarQuestions', '_id title platform difficulty pattern').select('-__v');
    if (!question) throw new AppError('Question not found', 404);
    res.json(formatResponse('Question retrieved successfully', { question }));
  } catch (error) { next(error); }
};

const getSimilarQuestions = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const limit = parseInt(req.query.limit) || 10;

    const target = await Question.findById(targetId).select('pattern tags title');
    if (!target) throw new AppError('Question not found', 404);

    let targetPatterns = target.pattern || [];
    if (!Array.isArray(targetPatterns)) targetPatterns = [targetPatterns];

    const filterConditions = [
      { $text: { $search: target.title } }
    ];

    if (targetPatterns.length > 0) {
      filterConditions.push({ pattern: { $in: targetPatterns } });
    }

    if (target.tags && target.tags.length > 0) {
      filterConditions.push({ tags: { $in: target.tags } });
    }

    const similar = await Question.aggregate([
      {
        $match: {
          _id: { $ne: target._id },
          isActive: true,
          $or: filterConditions
        }
      },
      {
        $addFields: {
          textScore: { $meta: 'textScore' },
          patternArray: {
            $cond: {
              if: { $isArray: "$pattern" },
              then: "$pattern",
              else: {
                $cond: {
                  if: { $eq: [{ $type: "$pattern" }, "string"] },
                  then: ["$pattern"],
                  else: []
                }
              }
            }
          },
          tagsArray: {
            $cond: {
              if: { $isArray: "$tags" },
              then: "$tags",
              else: {
                $cond: {
                  if: { $eq: [{ $type: "$tags" }, "string"] },
                  then: ["$tags"],
                  else: []
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          patternScore: {
            $cond: {
              if: {
                $gt: [
                  { $size: { $setIntersection: ["$patternArray", targetPatterns] } },
                  0
                ]
              },
              then: 100,
              else: 0
            }
          },
          tagOverlap: {
            $size: { $setIntersection: ["$tagsArray", target.tags || []] }
          }
        }
      },
      {
        $addFields: {
          totalScore: {
            $add: [
              { $ifNull: ['$textScore', 0] },
              { $multiply: ['$tagOverlap', 10] },
              '$patternScore'
            ]
          }
        }
      },
      { $sort: { totalScore: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          title: 1,
          problemLink: 1,
          platform: 1,
          difficulty: 1,
          tags: 1,
          pattern: 1,
          platformQuestionId: 1,
          totalScore: 1
        }
      }
    ]);

    res.json(formatResponse('Similar questions retrieved successfully', { similarQuestions: similar }));
  } catch (error) {
    next(error);
  }
};

const getPatterns = async (req, res, next) => {
  try {
    const patterns = await Question.distinct('pattern', { pattern: { $ne: [] }, isActive: true });
    res.json(formatResponse('Patterns retrieved successfully', { patterns }));
  } catch (error) { next(error); }
};

const getTags = async (req, res, next) => {
  try {
    const tags = await Question.distinct('tags', { isActive: true });
    res.json(formatResponse('Tags retrieved successfully', { tags }));
  } catch (error) { next(error); }
};

const getStatistics = async (req, res, next) => {
  try {
    const totalQuestions = await Question.countDocuments({ isActive: true });
    const byDifficulty = await Question.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
    ]);
    const byPlatform = await Question.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$platform', count: { $sum: 1 } } },
    ]);
    const totalPatterns = await Question.distinct('pattern', { pattern: { $ne: [] }, isActive: true });
    const totalTags = await Question.distinct('tags', { isActive: true });
    res.json(formatResponse('Statistics retrieved successfully', {
      statistics: {
        totalQuestions,
        byDifficulty: Object.fromEntries(byDifficulty.map(d => [d._id.toLowerCase(), d.count])),
        byPlatform: Object.fromEntries(byPlatform.map(p => [p._id, p.count])),
        totalPatterns: totalPatterns.length,
        totalTags: totalTags.length,
      }
    }));
  } catch (error) { next(error); }
};

const getDailyProblemAndGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const timeZone = req.userTimeZone;
    const refresh = req.query.refresh === 'true';

    const currentStreak = req.user.streak.current;
    const longestStreak = req.user.streak.longest;

    const todayStart = getStartOfDay(new Date(), timeZone);
    const todayEnd = getEndOfDay(new Date(), timeZone);

    const dailyGoal = await Goal.findOne({
      userId,
      goalType: 'daily',
      startDate: { $lte: todayStart },
      endDate: { $gte: todayEnd },
      status: 'active'
    }).lean();

    const todayGoal = dailyGoal ? {
      targetCount: dailyGoal.targetCount,
      completedCount: dailyGoal.completedCount,
      completionPercentage: dailyGoal.completionPercentage,
      status: dailyGoal.status
    } : null;

    const dashboardDaily = await dashboardService.getDailyProblem(userId, refresh);
    
    let dailyProblem = null;
    if (dashboardDaily && dashboardDaily.isPaidOnly) {
      dailyProblem = null;
    } else if (dashboardDaily && dashboardDaily.title) {
      const question = await Question.findOne({
        platform: 'LeetCode',
        platformQuestionId: dashboardDaily.platformQuestionId,
        isActive: true
      }).lean();
      
      dailyProblem = {
        date: dashboardDaily.date,
        title: dashboardDaily.title,
        titleSlug: dashboardDaily.platformQuestionId,
        difficulty: dashboardDaily.difficulty,
        link: dashboardDaily.link,
        tags: question?.tags || [],
        codeSnippets: question?.starterCode || {},
        isPodActive: dashboardDaily.isActive,
        questionId: dashboardDaily.questionId,
        totalTimeSpent: dashboardDaily.totalTimeSpent,
        revisionCount: dashboardDaily.revisionCount,
        attemptsCount: dashboardDaily.attemptsCount,
        lastPracticed: dashboardDaily.lastPracticed,
        status: dashboardDaily.status
      };
      
      if (!question) {
        try {
          const rawDaily = await leetcodeService.getDailyProblem(refresh);
          if (rawDaily && rawDaily.isPaidOnly) {
            console.log(`[DailyProblem] Skipping VIP daily problem: ${rawDaily.title}`);
            dailyProblem = null;
          } else if (rawDaily && rawDaily.titleSlug) {
            const fullDetails = await leetcodeService.fetchProblemDetails(rawDaily.link);
            let extractedTestCases = [];
            if (fullDetails.description) {
              const { extractTestCasesFromHtml } = require('../services/queueHandlers/questionExtractTestCases.handler');
              extractedTestCases = extractTestCasesFromHtml(fullDetails.description);
            }
            const starterCode = {};
            if (fullDetails.codeSnippets) {
              Object.entries(fullDetails.codeSnippets).forEach(([lang, code]) => {
                starterCode[lang.toLowerCase()] = code;
              });
            }
            const newQuestion = new Question({
              title: rawDaily.title,
              problemLink: rawDaily.link,
              platform: 'LeetCode',
              platformQuestionId: rawDaily.titleSlug,
              difficulty: rawDaily.difficulty,
              tags: rawDaily.tags || [],
              pattern: rawDaily.tags || [],
              solutionLinks: [],
              similarQuestions: [],
              contentRef: fullDetails.description || '',
              testCases: extractedTestCases,
              starterCode: starterCode,
              source: 'leetcode',
              createdBy: null,
              isActive: true
            });
            await newQuestion.save();
            console.log(`[DailyProblem] Auto-created question: ${rawDaily.title} (${rawDaily.titleSlug})`);
            if (extractedTestCases.length === 0 && fullDetails.description) {
              const { jobQueue } = require('../services/queue.service');
              await jobQueue.add('question.extract_testcases', { questionId: newQuestion._id });
            }
            if (!dailyProblem) dailyProblem = {};
            dailyProblem.tags = newQuestion.tags;
            dailyProblem.codeSnippets = newQuestion.starterCode;
            dailyProblem.questionId = newQuestion._id;
          }
        } catch (error) {
          console.error('Failed to auto-create daily question:', error.message);
        }
      }
    }

    const responseData = {
      dailyProblem: dailyProblem || null,
      todayGoal,
      currentStreak,
      longestStreak,
    };

    res.json(formatResponse('Daily problem and goal retrieved successfully', responseData));
  } catch (error) {
    next(error);
  }
};

const getQuestionsByPattern = async (req, res, next) => {
  try {
    const { patternSlug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(patternSlug)) {
      throw new AppError('Invalid pattern slug format', 400);
    }

    const patternName = await patternQuestionService.getPatternNameBySlug(patternSlug);
    if (!patternName) {
      throw new AppError('Pattern not found', 404);
    }

    const userId = req.user ? req.user._id : null;
    const { total, questions } = await patternQuestionService.getQuestionsByPattern(
      userId,
      patternName,
      page,
      limit
    );

    const patternDisplaySlug = patternName
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    res.json({
      success: true,
      statusCode: 200,
      message: 'Questions retrieved by pattern successfully',
      data: {
        pattern: {
          name: patternName,
          slug: patternDisplaySlug,
          totalQuestions: total
        },
        questions
      },
      meta: {
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        timestamp: new Date().toISOString()
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuestions,
  getQuestionById,
  getQuestionDetails,
  getQuestionDetailsByPlatform,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  restoreQuestion,
  permanentDeleteQuestion,
  getDeletedQuestions,
  getQuestionByPlatformId,
  getSimilarQuestions,
  getPatterns,
  getTags,
  getStatistics,
  fetchLeetCodeQuestion,
  searchLeetCodeQuestions,
  getDailyProblemAndGoal,
  getQuestionsByPattern,
};