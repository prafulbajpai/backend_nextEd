/**
 * User controller - Get current user (protected)
 * req.user set by authMiddleware
 */

/**
 * GET /api/users/me
 * Returns logged-in user profile (no password)
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = req.user;
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
