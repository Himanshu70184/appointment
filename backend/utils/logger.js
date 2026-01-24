const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logLevels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Format log message with timestamp
 */
const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level}] ${message} ${metaStr}\n`;
};

/**
 * Write log to file
 */
const writeToFile = (filename, message) => {
  const filepath = path.join(logsDir, filename);
  fs.appendFileSync(filepath, message, 'utf8');
};

/**
 * Log to console and file
 */
const log = (level, message, meta = {}) => {
  const formattedMessage = formatMessage(level, message, meta);
  
  // Console output
  if (process.env.NODE_ENV !== 'test') {
    switch (level) {
      case logLevels.ERROR:
        console.error(formattedMessage);
        break;
      case logLevels.WARN:
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  // File output
  const today = new Date().toISOString().split('T')[0];
  
  if (level === logLevels.ERROR) {
    writeToFile(`error-${today}.log`, formattedMessage);
  }
  
  if (process.env.LOG_ALL === 'true') {
    writeToFile(`app-${today}.log`, formattedMessage);
  }
};

/**
 * Logger class with convenience methods
 */
class Logger {
  constructor(context = '') {
    this.context = context;
  }

  error(message, meta = {}) {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    log(logLevels.ERROR, contextMessage, meta);
  }

  warn(message, meta = {}) {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    log(logLevels.WARN, contextMessage, meta);
  }

  info(message, meta = {}) {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    log(logLevels.INFO, contextMessage, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const contextMessage = this.context ? `[${this.context}] ${message}` : message;
      log(logLevels.DEBUG, contextMessage, meta);
    }
  }

  /**
   * Log API request
   */
  logRequest(req) {
    this.info('Request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userId: req.user?._id
    });
  }

  /**
   * Log API response
   */
  logResponse(req, res, duration) {
    this.info('Response', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  }

  /**
   * Log database query
   */
  logQuery(model, operation, query, duration) {
    this.debug('DB Query', {
      model,
      operation,
      query,
      duration: `${duration}ms`
    });
  }
}

/**
 * Create logger instance
 */
const createLogger = (context) => new Logger(context);

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  const logger = createLogger('ErrorHandler');
  
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?._id
  });

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Request logger middleware
 */
const requestLogger = (req, res, next) => {
  const logger = createLogger('API');
  const start = Date.now();

  logger.logRequest(req);

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function(body) {
    const duration = Date.now() - start;
    logger.logResponse(req, res, duration);
    return originalJson(body);
  };

  next();
};

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  Logger,
  createLogger,
  errorHandler,
  requestLogger,
  asyncHandler
};
