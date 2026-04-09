const router = require("express").Router();
const exercisesController = require("../controllers/exercises.controller");

const {
    validateExerciseId,
    validateCreateExercise,
    validateUpdateExercise
} = require("../validators/exercises.validator");

// CREATE
router.post(
    "/",
    validateCreateExercise,
    exercisesController.createExercise
);

// GET ALL
router.get(
    "/",
    exercisesController.getAllExercises
);

// GET ONE
router.get(
    "/:exerciseId",
    validateExerciseId,
    exercisesController.getExercise
);

// UPDATE
router.patch(
    "/:exerciseId",
    validateExerciseId,
    validateUpdateExercise,
    exercisesController.updateExercise
);

// DELETE
router.delete(
    "/:exerciseId",
    validateExerciseId,
    exercisesController.deleteExercise
);

module.exports = router;