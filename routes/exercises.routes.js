const router = require("express").Router();
const exercisesController = require("../controllers/exercises.controller");
const parseForm = require("../middlewares/parseForm.middleware");

const {
    validateExerciseId,
    validateCreateExercise,
    validateUpdateExercise
} = require("../validators/exercises.validator");

// Create
router.post(
    "/",
    parseForm(), 
    validateCreateExercise,
    exercisesController.createExercise
);

// Get all
router.get(
    "/",
    exercisesController.getAllExercises
);

router.get("/:exerciseId/progress", 
    exercisesController.getExerciseProgress
)

// Get one
router.get(
    "/:exerciseId",
    validateExerciseId,
    exercisesController.getExercise
);

// Update
router.patch(
    "/:exerciseId",
    parseForm(), 
    validateExerciseId,
    validateUpdateExercise,
    exercisesController.updateExercise
);

// Delete
router.delete(
    "/:exerciseId",
    validateExerciseId,
    exercisesController.deleteExercise
);

module.exports = router;