/**
 * Class controller - Create, list, join classes
 * All routes protected by authMiddleware
 */

const Class = require('../models/Class');

/**
 * POST /api/classes
 * Body: { title, description? }
 * Only tutors can create (optional: enforce in route or here)
 */
exports.createClass = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const tutorId = req.user.id;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Class title is required.',
      });
    }

    const newClass = await Class.create({
      title,
      description: description || '',
      tutor: tutorId,
      students: [],
    });

    const populated = await Class.findById(newClass._id)
      .populate('tutor', 'name email role')
      .lean();

    res.status(201).json({
      success: true,
      class: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/classes
 * Returns all classes (optionally filter by tutor / enrolled student later)
 */
exports.getClasses = async (req, res, next) => {
  try {
    const classes = await Class.find()
      .populate('tutor', 'name email role')
      .populate('students', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: classes.length,
      classes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/classes/join/:classId
 * Student joins a class (adds to students array)
 */
exports.joinClass = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: 'Class not found.',
      });
    }

    if (classDoc.students.some((id) => id.toString() === userId)) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this class.',
      });
    }

    classDoc.students.push(userId);
    await classDoc.save();

    const populated = await Class.findById(classDoc._id)
      .populate('tutor', 'name email role')
      .populate('students', 'name email role')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Joined class successfully.',
      class: populated,
    });
  } catch (error) {
    next(error);
  }
};
