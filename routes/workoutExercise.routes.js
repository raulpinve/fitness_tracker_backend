const router = require("express").Router();
const { validateExerciseId } = require("../validators/exercises.validator");
const { validateWorkoutId } = require("../validators/workouts.validator");
const workoutExerciseController = require("../controllers/workoutExercise.controller");
const { validateWorkoutExerciseId } = require("../validators/workoutExercise.validator");
const checkWorkoutNotClosed = require("../middlewares/checkWorkoutNotClosed");

router.get(
    "/active",
    validateWorkoutId, 
    workoutExerciseController.getWorkoutActiveExercises
);

// Create
router.post(
    "/",
    validateExerciseId, 
    validateWorkoutId,
    workoutExerciseController.createWorkoutExercise
);

// Obtener todos
router.get(
    "/",
    validateWorkoutId,
    workoutExerciseController.getWorkoutExercises
);

// Obtener uno
router.get(
    "/:workoutExerciseId",
    checkWorkoutNotClosed,
    workoutExerciseController.getWorkoutExercise
);

// Eliminar
router.delete(
    "/:workoutExerciseId",
    validateWorkoutExerciseId,
    checkWorkoutNotClosed,
    workoutExerciseController.deleteWorkoutExercise
);

module.exports = router;