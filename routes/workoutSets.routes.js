const router = require("express").Router();
const workoutSetsController = require("../controllers/workoutSets.controller");
const checkWorkoutNotClosed = require("../middlewares/checkWorkoutNotClosed");
const validateExerciseType = require("../validators/validateExerciseType.validator");
const { validateWorkoutExerciseId } = require("../validators/workoutExercise.validator");

const {
    validateWorkoutSetId,
    validateCreateWorkoutSet,
    validateUpdateWorkoutSet,
} = require("../validators/workoutSets.validator");

// Create workout set
router.post(
    "/",
    validateWorkoutExerciseId,
    checkWorkoutNotClosed,
    validateExerciseType("strength"),
    validateCreateWorkoutSet,
    workoutSetsController.createWorkoutSet
);

// Get workout set by ID
router.get(
    "/:workoutSetId",
    validateWorkoutSetId,
    workoutSetsController.getWorkoutSet
);

// Get all workout sets
router.get(
    "/",
    workoutSetsController.getWorkoutSets
);

// Update workout set
router.patch(
    "/:workoutSetId",
    validateWorkoutSetId,
    checkWorkoutNotClosed,
    validateUpdateWorkoutSet,
    workoutSetsController.updateWorkoutSet,
);

// Delete workout set
router.delete(
    "/:workoutSetId",
    validateWorkoutSetId,
    checkWorkoutNotClosed,
    workoutSetsController.deleteWorkoutSet
);

module.exports = router;