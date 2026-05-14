const cheerio = require('cheerio');
const Question = require('../../models/Question');

/**
 * Extract test cases from HTML content using regex on plain text.
 */
const extractTestCasesFromHtml = (html) => {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const testCases = [];

  const regex = /Input:?\s*(.*?)\s*Output:?\s*(.*?)(?=\s*(?:Example|Explanation|Constraints|$))/gs;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let stdin = match[1].trim();
    let expected = match[2].trim();
    stdin = stdin.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    expected = expected.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (stdin && expected) {
      testCases.push({ stdin, expected, isDefault: true });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const tc of testCases) {
    const key = `${tc.stdin.replace(/\s/g, '')}|${tc.expected.replace(/\s/g, '')}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(tc);
    }
  }

  return unique.slice(0, 3);
};

const handleQuestionExtractTestCases = async (job) => {
  const { questionId } = job.data;
  console.log(`[extract-testcases] Starting for question ${questionId}`);

  try {
    const question = await Question.findById(questionId);
    if (!question) throw new Error(`Question ${questionId} not found`);

    if (question.testCases && question.testCases.length > 0) {
      console.log(`[extract-testcases] Question ${questionId} already has test cases, skipping`);
      return;
    }

    if (!question.contentRef) {
      console.log(`[extract-testcases] No contentRef for question ${questionId}`);
      return;
    }

    const extracted = extractTestCasesFromHtml(question.contentRef);
    if (extracted.length === 0) {
      console.log(`[extract-testcases] No test cases extracted for question ${questionId}`);
      return;
    }

    // Save extracted test cases
    question.testCases = extracted;
    await question.save();
    console.log(`[extract-testcases] Added ${extracted.length} test cases to question ${questionId}`);

    // // Lazy load jobQueue to avoid circular dependency
    // const { jobQueue } = require('../queue.service');
    // await jobQueue.add('question.generate_runner', {
    //   questionId: question._id,
    // });
    // console.log(`[extract-testcases] Queued runner generation for question ${questionId}`);
  } catch (error) {
    console.error(`[extract-testcases] Error for question ${questionId}:`, error);
    throw error;
  }
};

module.exports = { handleQuestionExtractTestCases, extractTestCasesFromHtml };