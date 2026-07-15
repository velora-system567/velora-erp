/**
 * Validates req.body / req.query / req.params against a Zod schema.
 * Attaches parsed values to req.validated.
 * Passes ZodError to error handler on failure (returns 422).
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.validated = parsed;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
