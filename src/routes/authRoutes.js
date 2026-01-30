const express = require("express");
const router = express.Router();

console.log("AUTH ROUTES FILE LOADED");

const { register, login } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);

module.exports = router;
