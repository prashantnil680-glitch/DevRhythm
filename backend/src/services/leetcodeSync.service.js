const SystemConfig = require('../models/SystemConfig');
const Question = require('../models/Question');
const leetcodeService = require('./leetcode.service');
const { jobQueue } = require('./queue.service');

const LEETCODE_PAGE_SIZE = 50;
const REQUEST_DELAY_MS = 500;

/**
 * Check if initial sync has already been started
 */
async function isSyncStarted() {
  const config = await SystemConfig.findOne({ key: 'leetcode_initial_sync_started' });
  return config?.value === true;
}

/**
 * Mark that initial sync has started
 */
async function markSyncStarted() {
  await SystemConfig.findOneAndUpdate(
    { key: 'leetcode_initial_sync_started' },
    { $set: { value: true, description: 'Initial sync triggered' } },
    { upsert: true }
  );
}

/**
 * Check if a problem already exists by platform + platformQuestionId
 */
async function problemExists(platformQuestionId) {
  const existing = await Question.findOne({
    platform: 'LeetCode',
    platformQuestionId: platformQuestionId,
  }).select('_id');
  return !!existing;
}

/**
 * Save a basic question document (metadata only) using upsert to avoid duplicate key errors.
 * Returns true if a new document was created, false if it already existed.
 */
async function saveBasicQuestion(problem) {
  const { title, titleSlug, difficulty, tags, url } = problem;
  const normalizedUrl = url.endsWith('/') ? url : url + '/';

  const result = await Question.updateOne(
    {
      platform: 'LeetCode',
      platformQuestionId: titleSlug,
    },
    {
      $setOnInsert: {
        title: title,
        problemLink: normalizedUrl,
        platform: 'LeetCode',
        platformQuestionId: titleSlug,
        difficulty: difficulty,
        tags: tags,
        pattern: tags,
        source: 'leetcode',
        isActive: true,
        contentRef: '',
        testCases: [],
        starterCode: {},
      },
    },
    { upsert: true }
  );

  return result.upsertedCount === 1;
}

/**
 * Fetch a single page of problems from LeetCode GraphQL API
 */
async function fetchProblemPage(skip, limit) {
  const query = `
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
      ) {
        total: totalNum
        questions: data {
          title
          titleSlug
          difficulty
          isPaidOnly
          topicTags {
            name
          }
        }
      }
    }
  `;

  const variables = {
    categorySlug: "",
    limit: limit,
    skip: skip,
    filters: {},
  };

  const response = await leetcodeService._graphqlRequest(query, variables);
  const data = response.data?.problemsetQuestionList;
  if (!data) throw new Error('Failed to fetch problem list from LeetCode');

  const total = data.total;
  const questions = data.questions.filter(q => q.isPaidOnly !== true);

  const problems = questions.map(q => ({
    title: q.title,
    titleSlug: q.titleSlug,
    difficulty: q.difficulty,
    tags: q.topicTags.map(t => t.name),
    url: `https://leetcode.com/problems/${q.titleSlug}/`,
  }));

  return { total, problems };
}

/**
 * Sync all LeetCode problems (full initial sync)
 * @param {boolean} onlyNew - If true, skip problems that already exist in DB (used for manual refresh)
 */
async function syncAllLeetCodeProblems(onlyNew = false) {
  console.log(`[LeetCodeSync] Starting population (onlyNew=${onlyNew})...`);
  let skip = 0;
  let totalProcessed = 0;
  let totalSkippedExisting = 0;
  const limit = LEETCODE_PAGE_SIZE;

  const firstPage = await fetchProblemPage(0, limit);
  const totalProblems = firstPage.total;
  console.log(`[LeetCodeSync] Total public problems (including paid): ${totalProblems}`);

  while (true) {
    const { problems } = await fetchProblemPage(skip, limit);
    if (problems.length === 0) break;

    for (const problem of problems) {
      try {
        if (onlyNew && await problemExists(problem.titleSlug)) {
          totalSkippedExisting++;
          continue;
        }

        const saved = await saveBasicQuestion(problem);
        if (saved) {
          totalProcessed++;
          await jobQueue.add('leetcode.fetch_details', {
            platformQuestionId: problem.titleSlug,
            url: problem.url,
          });
        } else {
          totalSkippedExisting++;
        }
      } catch (err) {
        console.error(`[LeetCodeSync] Error processing ${problem.titleSlug}:`, err.message);
        totalSkippedExisting++;
      }
    }

    console.log(`[LeetCodeSync] Processed ${skip + problems.length} / ${totalProblems} (new: ${totalProcessed}, skipped existing: ${totalSkippedExisting})`);
    skip += limit;
    if (skip >= totalProblems) break;
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  console.log(`[LeetCodeSync] Completed. New problems added: ${totalProcessed}, skipped (already exist): ${totalSkippedExisting}`);
}

/**
 * Entry point for initial sync – runs only once on first server start.
 */
async function startInitialLeetcodeSync() {
  try {
    const alreadyStarted = await isSyncStarted();
    if (alreadyStarted) {
      console.log('[LeetCodeSync] Initial sync already started. Skipping.');
      return;
    }
    await markSyncStarted();
    console.log('[LeetCodeSync] Triggering initial LeetCode problem population (background)');
    syncAllLeetCodeProblems(false).catch(err => console.error('[LeetCodeSync] Background sync failed:', err));
  } catch (error) {
    console.error('[LeetCodeSync] Failed to start sync:', error);
  }
}

/**
 * Manual refresh – fetches only new problems (not already in DB) and queues details.
 * Returns statistics about added problems.
 */
async function refreshNewLeetCodeProblems() {
  console.log('[LeetCodeSync] Manual refresh triggered – fetching new problems & missing details');
  const startTime = Date.now();
  let totalNew = 0;
  let totalMissingDetails = 0;
  let skip = 0;
  const limit = LEETCODE_PAGE_SIZE;

  const firstPage = await fetchProblemPage(0, limit);
  const totalProblems = firstPage.total;

  while (true) {
    const { problems } = await fetchProblemPage(skip, limit);
    if (problems.length === 0) break;

    for (const problem of problems) {
      try {
        const existing = await Question.findOne({
          platform: 'LeetCode',
          platformQuestionId: problem.titleSlug,
        }).select('contentRef testCases').lean();

        if (!existing) {
          const inserted = await saveBasicQuestion(problem);
          if (inserted) {
            totalNew++;
            await jobQueue.add('leetcode.fetch_details', {
              platformQuestionId: problem.titleSlug,
              url: problem.url,
            });
          }
        } else {
          const hasDetails = existing.contentRef && existing.contentRef.trim() !== '';
          if (!hasDetails) {
            totalMissingDetails++;
            console.log(`[LeetCodeSync] Re‑queuing missing details for ${problem.titleSlug}`);
            await jobQueue.add('leetcode.fetch_details', {
              platformQuestionId: problem.titleSlug,
              url: problem.url,
            });
          }
        }
      } catch (err) {
        console.error(`[LeetCodeSync] Error processing ${problem.titleSlug}:`, err.message);
      }
    }

    console.log(`[LeetCodeSync] Processed ${skip + problems.length} / ${totalProblems} (new: ${totalNew}, missing details re‑queued: ${totalMissingDetails})`);
    skip += limit;
    if (skip >= totalProblems) break;
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[LeetCodeSync] Manual refresh completed in ${duration}s. Added ${totalNew} new problems, re‑queued details for ${totalMissingDetails} existing problems.`);
  return { added: totalNew, missingDetailsRequeued: totalMissingDetails, duration };
}

/**
 * Repair incomplete LeetCode questions (missing contentRef, testCases, starterCode).
 * Queues fetch details jobs for each incomplete question.
 * @returns {Promise<{totalIncomplete: number, queued: number}>}
 */
async function repairIncompleteQuestions() {
  console.log('[LeetCodeSync] Scanning for incomplete questions...');

  const incomplete = await Question.find({
    platform: 'LeetCode',
    isActive: true,
    $or: [
      // Missing or empty contentRef
      { contentRef: { $exists: false } },
      { contentRef: '' },
      { contentRef: null },
      // ContentRef is a URL or too short (< 200 chars)
      { contentRef: { $regex: /^https?:\/\// } },
      { contentRef: { $lt: 200 } },
      // Missing test cases
      { testCases: { $size: 0 } },
      // Missing starter code
      { starterCode: { $exists: false } },
      { starterCode: {} },
    ],
  }).select('_id platformQuestionId problemLink').lean();

  const totalIncomplete = incomplete.length;
  if (totalIncomplete === 0) {
    console.log('[LeetCodeSync] No incomplete questions found.');
    return { totalIncomplete: 0, queued: 0 };
  }

  console.log(`[LeetCodeSync] Found ${totalIncomplete} incomplete questions. Queuing repairs...`);

  let queued = 0;
  for (const q of incomplete) {
    try {
      await jobQueue.add('leetcode.fetch_details', {
        platformQuestionId: q.platformQuestionId,
        url: q.problemLink,
      });
      queued++;
    } catch (err) {
      console.error(`[LeetCodeSync] Failed to queue repair for ${q.platformQuestionId}:`, err.message);
    }
  }

  console.log(`[LeetCodeSync] Queued ${queued}/${totalIncomplete} repair jobs.`);
  return { totalIncomplete, queued };
}

module.exports = {
  startInitialLeetcodeSync,
  refreshNewLeetCodeProblems,
  repairIncompleteQuestions,
};