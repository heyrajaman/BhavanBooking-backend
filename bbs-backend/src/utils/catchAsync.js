/**
 * Wraps an async controller function to automatically catch errors
 * and pass them to the global error handler.
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    // If the controller promise rejects (throws an error), catch it and pass to next()
    fn(req, res, next).catch(next);
  };
};
