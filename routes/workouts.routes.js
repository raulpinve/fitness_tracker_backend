const router = require("express").Router();
const workoutsController = require("../controllers/workouts.controller");
const { validateRoutineId } = require("../validators/routines.validator");

const {
    validateWorkoutId,
    validateCreateWorkout,
    validateRoutineIdCampoOptional,
} = require("../validators/workouts.validator");

// Create workout
router.post(
    "/",
    validateRoutineIdCampoOptional,
    validateCreateWorkout,
    workoutsController.createWorkout
);

router.get("/:workoutId/summary", 
    validateWorkoutId,
    workoutsController.getWorkoutSummary
);

router.get('/history', 
    workoutsController.getWorkoutHistory
);


// Get workout by ID
router.get(
    "/:workoutId",
    validateWorkoutId,
    workoutsController.getWorkout
);

// Get workouts 
router.get(
    "/",
    workoutsController.getAllWorkouts
);

router.patch("/:routineId/update-routine-progress",
    validateRoutineId, 
    workoutsController.updateRoutineProgress
);

// Finish workout
router.patch(
    "/:workoutId/finish",
    validateWorkoutId,
    workoutsController.finishWorkout
);

// Delete workout
router.delete(
    "/:workoutId",
    validateWorkoutId,
    workoutsController.deleteWorkout
);



module.exports = router;