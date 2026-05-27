const Question = require('../../models/Question');
const leetcodeService = require('../leetcode.service');
const { extractTestCasesFromHtml } = require('./questionExtractTestCases.handler');

/**
 * Bull job handler to fetch full details for a LeetCode problem.
 * Expected job.data: { platformQuestionId, url }
 */
const handleFetchLeetcodeDetails = async (job) => {
  const { platformQuestionId, url } = job.data;

  if (!platformQuestionId || !url) {
    throw new Error('Missing platformQuestionId or url in job data');
  }

  console.log(`[LeetCodeDetail] Fetching details for: ${platformQuestionId}`);

  try {
    // Check if question already has details (contentRef not empty)
    const existing = await Question.findOne({
      platform: 'LeetCode',
      platformQuestionId: platformQuestionId,
    }).select('contentRef starterCode testCases').lean();

    if (existing && existing.contentRef && existing.contentRef.trim() !== '') {
      console.log(`[LeetCodeDetail] Question ${platformQuestionId} already has details, skipping.`);
      return;
    }

    // Fetch details from LeetCode (handles VIP internally)
    const details = await leetcodeService.fetchProblemDetails(url);

    if (!details || !details.description) {
      console.log(`[LeetCodeDetail] No description returned for ${platformQuestionId}, skipping.`);
      return;
    }

    // Extract test cases from HTML description
    const extractedTestCases = extractTestCasesFromHtml(details.description);

    // Prepare starter code snippets (filter for supported languages)
    const allowedLanguages = ['cpp', 'c++', 'javascript', 'java', 'python', 'python3'];
    const starterCode = {};
    if (details.codeSnippets) {
      for (const [lang, code] of Object.entries(details.codeSnippets)) {
        const normalizedLang = lang.toLowerCase();
        if (allowedLanguages.includes(normalizedLang)) {
          const targetLang = normalizedLang === 'c++' ? 'cpp' : normalizedLang;
          starterCode[targetLang] = code;
        }
      }
    }

    // Update the question document with fetched details
    const updateResult = await Question.updateOne(
      {
        platform: 'LeetCode',
        platformQuestionId: platformQuestionId,
      },
      {
        $set: {
          contentRef: details.description,
          testCases: extractedTestCases,
          starterCode: starterCode,
          // Optionally update tags/pattern if they are more complete
          tags: details.tags,
          pattern: details.tags,
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      console.log(`[LeetCodeDetail] No question found to update for ${platformQuestionId}`);
    } else {
      console.log(`[LeetCodeDetail] Successfully updated ${platformQuestionId} (${extractedTestCases.length} test cases, ${Object.keys(starterCode).length} languages)`);
    }
  } catch (error) {
    // If VIP error, do not retry – the question will remain without details (acceptable)
    if (error.code === 'VIP_QUESTION_NOT_ALLOWED') {
      console.log(`[LeetCodeDetail] Skipping VIP question: ${platformQuestionId}`);
      return;
    }
    // For other errors, rethrow to let Bull retry (with backoff)
    console.error(`[LeetCodeDetail] Failed for ${platformQuestionId}:`, error.message);
    throw error;
  }
};

module.exports = { handleFetchLeetcodeDetails };