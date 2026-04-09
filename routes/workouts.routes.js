const router = require("express").Router();
const workoutsController = require("../controllers/workouts.controller");

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

// Get workouts 
router.get(
    "/",
    workoutsController.getAllWorkouts
);

// Get workout by ID
router.get(
    "/:workoutId",
    validateWorkoutId,
    workoutsController.getWorkout
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