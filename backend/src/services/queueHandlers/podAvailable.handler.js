const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { invalidateCache } = require('../../middleware/cache');

const BATCH_SIZE = 500;

/**
 * Handle pod.available job
 * Creates a POD available notification for all active users.
 * Processes users in batches to avoid memory issues.
 */
const handlePodAvailable = async (job) => {
  const { title, titleSlug, link, date } = job.data;
  let skip = 0;
  let totalCreated = 0;

  console.log(`[pod.available] Creating notifications for POD: ${title}`);

  while (true) {
    const users = await User.find({ isActive: true })
      .select('_id')
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (users.length === 0) break;

    const notifications = users.map(user => ({
      userId: user._id,
      type: 'pod_available',
      title: 'New Problem of the Day',
      message: `Today's problem: "${title}" is now available.`,
      data: {
        title,
        titleSlug,
        platformQuestionId: titleSlug,
        link,
        date,
      },
      channel: 'in-app',
      status: 'sent',
      scheduledAt: new Date(),
    }));

    await Notification.insertMany(notifications, { ordered: false });
    totalCreated += notifications.length;

    // Invalidate caches for these users (batch deletion of cache keys)
    for (const user of users) {
      await invalidateCache(`notifications:${user._id}:*`);
    }

    skip += BATCH_SIZE;
  }

  console.log(`[pod.available] Created ${totalCreated} POD notifications for ${title}`);
};

module.exports = { handlePodAvailable };