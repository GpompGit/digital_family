// =============================================================================
// requireAuth.js — Authentication Middleware
// =============================================================================
//
// WHAT IS MIDDLEWARE?
// Middleware is a function that runs BETWEEN receiving a request and executing
// the route handler. It can:
//   - Allow the request to continue (call next())
//   - Block the request (send an error response)
//   - Modify the request (add data to req)
//
// HOW IS THIS USED?
// In route files:   router.get('/secret', requireAuth, handlerFunction)
// The route handler only runs if requireAuth calls next().
//
// HOW DOES IT WORK?
// When a user logs in (auth.js), we store their userId in the session:
//   req.session.userId = user.id
// On every subsequent request, express-session reads the cookie, loads the
// session from MariaDB, and populates req.session. If userId exists, the
// user is logged in.
//
// HTTP STATUS CODES:
//   401 = "Unauthorized" — you need to log in
//   403 = "Forbidden" — you're logged in but don't have permission
// =============================================================================

export default function requireAuth(req, res, next) {
  // Check if a session exists AND has a userId (set during login)
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // User is authenticated — let the request continue to the route handler
  next();
}
