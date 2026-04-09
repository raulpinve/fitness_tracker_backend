const router = require("express").Router();
const routineExercisesController = require("../controllers/routineExercises.controller");
const { validateExerciseId } = require("../validators/exercises.validator");

const {
    validateRoutineExerciseId,
    validateCreateRoutineExercise,
    validateUpdateRoutineExercise,
    validateIfExerciseWasCreatedOnRoutine,
} = require("../validators/routineExercises.validator");
const { validateRoutineId } = require("../validators/routines.validator");

// Create routine exercise
router.post(
    "/",
    validateRoutineId,
    validateExerciseId,
    validateIfExerciseWasCreatedOnRoutine,
    validateCreateRoutineExercise,
    routineExercisesController.createRoutineExercise
);

// Get all exercise from a routine
router.get(
    "/routine/:routineId",
    validateRoutineId,
    routineExercisesController.getRoutineExercises
);

// Get routine exercise
router.get(
    "/:routineExerciseId",
    validateRoutineExerciseId,
    routineExercisesController.getRoutineExercise
);

// Update a routine exercise 
router.patch(
    "/:routineExerciseId",
    validateRoutineExerciseId,
    validateUpdateRoutineExercise,
    routineExercisesController.updateRoutineExercise
);

// Delete a rotine exercise
router.delete(
    "/:routineExerciseId",
    validateRoutineExerciseId,
    routineExercisesController.deleteRoutineExercise
);

module.exports = router;