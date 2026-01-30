/**
 * User controller - Get current user (protected)
 * req.user set by authMiddleware
 */

/**
 * GET /api/users/me
 * Returns logged-in user profile (no password)
 */
/**
 * User Controller
 */

// GET /api/users/me
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
};

module.exports = { getMe };

