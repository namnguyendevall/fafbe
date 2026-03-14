/**
 * Middleware to check if the user has the required roles.
 * Must be used after authMiddleware.
 * 
 * @param {string[]} allowedRoles - Array of roles allowed to access the route.
 */
module.exports = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: No user found" });
    }

    const userRole = req.user.role?.toLowerCase();
    const allowed = allowedRoles.map(r => r.toLowerCase());

    const fs = require('fs');
    const logMsg = `[RoleMiddleware] ${new Date().toISOString()} - User: ${req.user.role} -> ${userRole}, Allowed: ${allowed}\n`;
    fs.appendFileSync('d:/FAF-BE/role_logs.txt', logMsg);

    if (!allowed.includes(userRole)) {
      return res.status(403).json({ 
        message: "Forbidden: You do not have permission to access this resource" 
      });
    }

    next();
  };
};
