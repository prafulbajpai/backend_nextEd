/**
 * JWT Authentication Middleware
 * Protects routes and attaches req.user
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

// --------------------
// PROTECT MIDDLEWARE
// --------------------
const protect = async (req, res, next) => {
 let token;

 // Get token from header: Authorization: Bearer TOKEN
 if (
   req.headers.authorization &&
   req.headers.authorization.startsWith("Bearer")
 ) {
   token = req.headers.authorization.split(" ")[1];
 }

 // No token
 if (!token) {
   return res.status(401).json({
     success: false,
     message: "Not authorized, token missing"
   });
 }

 try {
   // Verify token
   const decoded = jwt.verify(token, process.env.JWT_SECRET);

   // Find user
   const user = await User.findById(decoded.id).select("-password");

   if (!user) {
     return res.status(401).json({
       success: false,
       message: "User not found"
     });
   }

   // Attach user to request
   req.user = user;
   next();
 } catch (error) {
   return res.status(401).json({
     success: false,
     message: "Not authorized, token invalid"
   });
 }
};

module.exports = { protect, authMiddleware: protect };

