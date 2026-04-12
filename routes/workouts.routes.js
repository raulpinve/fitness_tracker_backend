const router = require("express").Router();
const workoutsController = require("../controllers/workouts.controller");
const { validateRoutineId } = require("../validators/routines.validator");

const {
    validateWorkoutId,
    validateCreateWorkout,
} = require("../validators/workouts.validator");

// Create workout
router.post(
    "/",
    validateCreateWorkout,
    workoutsController.createWorkout
);

router.get("/:workoutId/summary", 
    validateWorkoutId,
    workoutsController.summary
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

router.patch("/update-routine-progress",
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