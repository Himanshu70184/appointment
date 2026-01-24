/**
 * Custom Error class with status code
 */
class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error
 */
class ValidationError extends ErrorResponse {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

/**
 * Authentication Error
 */
class AuthenticationError extends ErrorResponse {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

/**
 * Authorization Error
 */
class AuthorizationError extends ErrorResponse {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

/**
 * Not Found Error
 */
class NotFoundError extends ErrorResponse {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

/**
 * Conflict Error
 */
class ConflictError extends ErrorResponse {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

/**
 * Rate Limit Error
 */
class RateLimitError extends ErrorResponse {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * Server Error
 */
class ServerError extends ErrorResponse {
  constructor(message = 'Internal server error') {
    super(message, 500);
  }
}

/**
 * Database Error
 */
class DatabaseError extends ErrorResponse {
  constructor(message = 'Database operation failed') {
    super(message, 500);
  }
}

/**
 * External Service Error
 */
class ExternalServiceError extends ErrorResponse {
  constructor(service, message = 'External service unavailable') {
    super(`${service}: ${message}`, 503);
    this.service = service;
  }
}

module.exports = {
  ErrorResponse,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServerError,
  DatabaseError,
  ExternalServiceError
};
