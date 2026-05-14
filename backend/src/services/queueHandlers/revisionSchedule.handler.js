const revisionService = require('../revision.service');

const handleRevisionSchedule = async (job) => {
  const { userId, questionId, baseDate } = job.data;

  try {
    // Use the service that also handles duplicate checks
    await revisionService.createRevisionSchedule(userId, questionId, baseDate);
    console.log(`Revision schedule created for user ${userId}, question ${questionId}`);
  } catch (error) {
    console.error('Error in revisionSchedule handler:', error);
    // Rethrow so Bull can retry if needed
    throw error;
  }
};

module.exports = { handleRevisionSchedule };