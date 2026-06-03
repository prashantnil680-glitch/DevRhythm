const Question = require('../../models/Question');
const leetcodeService = require('../leetcode.service');
const { extractTestCasesFromHtml } = require('./questionExtractTestCases.handler');

/**
 * Bull job handler to fetch full details for a LeetCode problem.
 * Expected job.data: { platformQuestionId, url (ignored, we use platformQuestionId) }
 */
const handleFetchLeetcodeDetails = async (job) => {
  const { platformQuestionId, url } = job.data;

  if (!platformQuestionId) {
    throw new Error('Missing platformQuestionId in job data');
  }

  // Construct correct LeetCode URL from platformQuestionId
  const correctUrl = `https://leetcode.com/problems/${platformQuestionId}/`;

  console.log(`[LeetCodeDetail] Fetching details for: ${platformQuestionId} using ${correctUrl}`);

  try {
    // Check if question already has good details
    const existing = await Question.findOne({
      platform: 'LeetCode',
      platformQuestionId: platformQuestionId,
    }).select('contentRef starterCode testCases problemLink').lean();

    const hasValidContent = existing?.contentRef &&
      existing.contentRef.trim().length > 200 &&
      !existing.contentRef.startsWith('http');
    const hasTestCases = existing?.testCases && existing.testCases.length > 0;
    const hasStarterCode = existing?.starterCode && Object.keys(existing.starterCode).length > 0;
    const hasValidProblemLink = existing?.problemLink === correctUrl;

    if (hasValidContent && hasTestCases && hasStarterCode && hasValidProblemLink) {
      console.log(`[LeetCodeDetail] Question ${platformQuestionId} already has complete details, skipping.`);
      return;
    }

    // Fetch details from LeetCode using the correct URL
    const details = await leetcodeService.fetchProblemDetails(correctUrl);

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

    // Update the question document with fetched details and correct problem link
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
          tags: details.tags,
          pattern: details.tags,
          problemLink: correctUrl,
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      console.log(`[LeetCodeDetail] No question found to update for ${platformQuestionId}`);
    } else {
      console.log(`[LeetCodeDetail] Successfully updated ${platformQuestionId} (${extractedTestCases.length} test cases, ${Object.keys(starterCode).length} languages, problemLink fixed)`);
    }
  } catch (error) {
    if (error.code === 'VIP_QUESTION_NOT_ALLOWED') {
      console.log(`[LeetCodeDetail] Skipping VIP question: ${platformQuestionId}`);
      return;
    }
    console.error(`[LeetCodeDetail] Failed for ${platformQuestionId}:`, error.message);
    throw error;
  }
};

module.exports = { handleFetchLeetcodeDetails };