/**
 * Script to create all required database indexes.
 * Run with: node src/scripts/create-indexes.js
 */

const mongoose = require('mongoose');
const config = require('../config');

async function createIndexes() {
  try {
    await mongoose.connect(config.database.uri, config.database.connectionOptions);
    console.log('Connected to MongoDB');

    // Load models
    const Question = require('../models/Question');
    const UserQuestionProgress = require('../models/UserQuestionProgress');
    const CodeExecutionHistory = require('../models/CodeExecutionHistory'); // <-- ADDED

    // Create indexes for Question collection
    console.log('Creating indexes for Question collection...');
    const questionIndexes = await Question.createIndexes();
    console.log('Question indexes created:', questionIndexes);

    // Create indexes for UserQuestionProgress collection
    console.log('Creating indexes for UserQuestionProgress collection...');
    const progressIndexes = await UserQuestionProgress.createIndexes();
    console.log('UserQuestionProgress indexes created:', progressIndexes);

    // Create indexes for CodeExecutionHistory collection (new compound index)
    console.log('Creating indexes for CodeExecutionHistory collection...');
    const historyIndexes = await CodeExecutionHistory.createIndexes();
    console.log('CodeExecutionHistory indexes created:', historyIndexes);

    console.log('All indexes created successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();