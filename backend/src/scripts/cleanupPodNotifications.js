/**
 * One-time cleanup script to delete all POD notifications (pod_available and pod_solved)
 * that were created before today (UTC).
 *
 * Run with: node scripts/cleanupPodNotifications.js
 */

const mongoose = require('mongoose');
const config = require('../config');
const Notification = require('../models/Notification');
const { getStartOfDay } = require('../utils/helpers/date');

async function cleanupPodNotifications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.database.uri, config.database.connectionOptions);
    console.log('✅ Connected to MongoDB');

    // Get today's start in UTC
    const todayStart = getStartOfDay(new Date(), 'UTC');

    // Count documents that will be deleted
    const count = await Notification.countDocuments({
      type: { $in: ['pod_available', 'pod_solved'] },
      createdAt: { $lt: todayStart },
    });

    console.log(`📊 Found ${count} old POD notifications to delete (created before ${todayStart.toISOString()})`);

    if (count === 0) {
      console.log('✅ No old POD notifications found. Nothing to delete.');
      await mongoose.disconnect();
      return;
    }

    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      readline.question(`⚠️  This will delete ${count} notifications. Are you sure? (y/N) `, resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('❌ Aborted.');
      await mongoose.disconnect();
      return;
    }

    // Perform deletion
    const result = await Notification.deleteMany({
      type: { $in: ['pod_available', 'pod_solved'] },
      createdAt: { $lt: todayStart },
    });

    console.log(`✅ Deleted ${result.deletedCount} old POD notifications.`);
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB.');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run the script
cleanupPodNotifications();