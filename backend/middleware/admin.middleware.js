const authMiddleware = require('./auth.middleware');

const adminMiddleware = async (req, res, next) => {
  await authMiddleware(req, res, () => {
    if (!req.user?.is_admin) {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    next();
  });
};

module.exports = adminMiddleware;
