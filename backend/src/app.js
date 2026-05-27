const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const rateLimit = require('express-rate-limit');
const passport = require('./config/oauth');
const config = require('./config');
const middleware = require('./middleware');
const routes = require('./routes');
const { attachUserTimeZone } = require('./middleware/timezone'); 

const app = express();

// Trust first proxy (required for Render's load balancer)
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const redisClient = require('./config/redis');
const sessionStore = new RedisStore({ client: redisClient.client });
app.use(session({
  store: sessionStore,
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.isProduction,
    httpOnly: true,
    maxAge: config.session.maxAge,
    sameSite: 'strict'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Attach user timezone to every request (UTC if not logged in)
app.use(attachUserTimeZone);

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests, please try again later.',
    data: null,
    meta: {},
    error: { code: 'RATE_LIMIT_EXCEEDED' }
  }
});
app.use(limiter);

app.use(middleware.morganMiddleware);
app.use(middleware.logRequest);
app.use('/api/v1', routes);
app.use(middleware.errorHandler);

module.exports = app;