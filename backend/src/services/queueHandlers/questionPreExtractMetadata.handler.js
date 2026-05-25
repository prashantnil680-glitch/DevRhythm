const metadataService = require('../codeExecution/metadata.service');

/**
 * Handle question.pre_extract_metadata job
 * Pre‑extracts execution metadata for all supported languages for a given question.
 * This runs in the background after a question is created or updated.
 *
 * @param {Object} job – Bull job object
 * @param {Object} job.data – Contains { questionId }
 */
const handleQuestionPreExtractMetadata = async (job) => {
  const { questionId } = job.data;

  if (!questionId) {
    throw new Error('Missing questionId in pre_extract_metadata job');
  }

  console.log(`[pre_extract_metadata] Starting metadata extraction for question ${questionId}`);

  try {
    const results = await metadataService.preExtractAll(questionId);
    const languages = Object.keys(results);
    console.log(`[pre_extract_metadata] Extracted metadata for question ${questionId} in languages: ${languages.join(', ')}`);
  } catch (error) {
    console.error(`[pre_extract_metadata] Failed for question ${questionId}:`, error);
    throw error;
  }
};

module.exports = { handleQuestionPreExtractMetadata };