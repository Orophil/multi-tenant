'use strict';

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const message = err.expose ? err.message : err.message || 'Internal server error';
  res.status(status).json({ error: message });
}

module.exports = { asyncHandler, errorHandler };
