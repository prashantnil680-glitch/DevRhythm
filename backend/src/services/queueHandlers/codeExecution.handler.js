const CodeExecutionJob = require('../../models/CodeExecutionJob');
const codeExecutionController = require('../../controllers/codeExecution.controller');

/**
 * Bull queue processor for asynchronous code execution.
 * Expected job.data: { jobId }
 * 
 * This handler:
 * 1. Fetches the job document from DB
 * 2. Marks status as 'processing'
 * 3. Executes the code (reuses existing runCode logic)
 * 4. Updates job with result or error
 */
const handleCodeExecution = async (job) => {
  const { jobId } = job.data;

  if (!jobId) {
    throw new Error('Missing jobId in code execution job');
  }

  console.log(`[CodeExecutionWorker] Processing job ${jobId}`);

  // Fetch the job document
  const jobDoc = await CodeExecutionJob.findOne({ jobId });
  if (!jobDoc) {
    throw new Error(`Job ${jobId} not found in database`);
  }

  // Update status to processing
  jobDoc.status = 'processing';
  jobDoc.startedAt = new Date();
  jobDoc.bullJobId = job.id;
  await jobDoc.save();

  // Prepare a mock request object that contains all needed data
  const mockReq = {
    user: { _id: jobDoc.userId },
    body: {
      language: jobDoc.language,
      code: jobDoc.code,
      questionId: jobDoc.questionId,
      testCases: jobDoc.testCases,
    },
    userTimeZone: jobDoc.timezone,
  };

  // Mock response object to capture output
  let responseData = null;
  let errorOccurred = null;

  const mockRes = {
    status: (code) => ({
      json: (data) => {
        responseData = data;
      },
    }),
    json: (data) => {
      responseData = data;
    },
  };

  // Next function to catch errors
  const mockNext = (err) => {
    errorOccurred = err;
  };

  try {
    // Call the existing controller function
    await codeExecutionController.runCode(mockReq, mockRes, mockNext);

    if (errorOccurred) {
      throw errorOccurred;
    }

    // Store result
    jobDoc.status = 'completed';
    jobDoc.result = responseData?.data || responseData;
    jobDoc.completedAt = new Date();
    jobDoc.progress = 100;
    await jobDoc.save();

    console.log(`[CodeExecutionWorker] Job ${jobId} completed successfully`);
  } catch (err) {
    console.error(`[CodeExecutionWorker] Job ${jobId} failed:`, err.message);
    jobDoc.status = 'failed';
    jobDoc.errorMessage = err.message;
    jobDoc.completedAt = new Date();
    await jobDoc.save();
    // Re-throw to let Bull retry if needed (up to 3 times)
    throw err;
  }
};

module.exports = { handleCodeExecution };