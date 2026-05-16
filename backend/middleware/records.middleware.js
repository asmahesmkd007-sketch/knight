const authMiddleware = require('./auth.middleware');

const recordsMiddleware = async (req, res, next) => {
  await authMiddleware(req, res, () => {
    if (!req.user?.is_admin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    next();
  });
};

module.exports = recordsMiddleware;
