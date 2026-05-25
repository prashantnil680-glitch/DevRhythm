const mongoose = require('mongoose');
const config = require('./index');

mongoose.set('strictQuery', false);

const connectionOptions = {
  maxPoolSize: config.database.maxPoolSize,
  minPoolSize: config.database.minPoolSize,
  serverSelectionTimeoutMS: config.database.connectionTimeoutMs,
  socketTimeoutMS: 45000,
  family: 4
};

if (config.isProduction) {
  connectionOptions.readPreference = 'secondaryPreferred';
}

const connectDB = async () => {
  try {
    await mongoose.connect(config.database.uri, connectionOptions);
    // console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

const connectionPromise = connectDB();

mongoose.connection.on('connected', () => console.log('Mongoose connected to database'));
mongoose.connection.on('error', (err) => console.error('Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = mongoose;
module.exports.ready = connectionPromise;