const app = require('./app');
const config = require('./config');
const mongoose = require('./config/database');
const { client: redis, waitForRedis } = require('./config/redis');
const { startAllJobs } = require('./jobs');
const { startQueueWorkers } = require('./services/queue.service');

const startServer = async () => {
  try {
    // Wait for database and Redis
    await mongoose.connect(config.database.uri, config.database.connectionOptions);
    // console.log('MongoDB connected');
    await waitForRedis();

    // Start queue workers
    startQueueWorkers();

    // Start cron jobs
    startAllJobs();

    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}, Instance: ${process.env.RAILWAY_INSTANCE_ID || 'local'}`);
    });

    const gracefulShutdown = () => {
      console.log('Received shutdown signal, closing server...');
      server.close(async () => {
        console.log('HTTP server closed');
        await mongoose.disconnect();
        await redis?.quit();
        process.exit(0);
      });
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      gracefulShutdown();
    });
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Rejection:', reason);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();