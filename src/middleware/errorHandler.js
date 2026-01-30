/**
 * Global Error Handler Middleware
 * Sends consistent JSON errors
 */

const errorHandler = (err, req, res, next) => {
  console.error(err); // Log for debugging

  let statusCode = res.statusCode && res.statusCode !== 200
    ? res.statusCode
    : 500;

  let message = err.message || "Internal Server Error";

  // --------------------
  // MONGOOSE ERRORS
  // --------------------

  // Validation Error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate field value entered";
  }

  // Cast Error (invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Resource not found with given id";
  }

  // --------------------
  // JWT ERRORS
  // --------------------
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // --------------------
  // RESPONSE
  // --------------------
  res.status(statusCode).json({
    success: false,
    message,
    stack:
      process.env.NODE_ENV === "development"
        ? err.stack
        : undefined
  });
};

module.exports = errorHandler;
