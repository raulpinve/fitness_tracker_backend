const router = require("express").Router();
const { validateWorkoutExerciseId } = require("../validators/workoutExercise.validator");
const validateExerciseType = require("../validators/validateExerciseType.validator");
const workoutSetsController = require("../controllers/workoutSets.controller");
const checkWorkoutNotClosed = require("../middlewares/checkWorkoutNotClosed");
const { validateExerciseId } = require("../validators/exercises.validator");
const { validateWorkoutId } = require("../validators/workouts.validator");

const {
    validateWorkoutSetId,
    validateCreateWorkoutSet,
    validateUpdateWorkoutSet,
} = require("../validators/workoutSets.validator");

// Create workout set
router.post(
    "/",
    validateWorkoutId, 
    validateExerciseId,
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
    validateExerciseId, 
    validateWorkoutId,
    workoutSetsController.getAllWorkoutSets
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