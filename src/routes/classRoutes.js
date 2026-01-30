/**
 * Class routes - Create, list, join (all protected)
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const classController = require('../controllers/classController');

router.post('/', authMiddleware, classController.createClass);
router.get('/', authMiddleware, classController.getClasses);
router.post('/join/:classId', authMiddleware, classController.joinClass);

module.exports = router;
