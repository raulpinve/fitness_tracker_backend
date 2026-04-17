const router = require("express").Router();
const cardioLogsController = require("../controllers/cardioLog.controller");
const { validateWorkoutExerciseId } = require("../validators/workoutExercise.validator");
const validateExerciseType = require("../validators/validateExerciseType.validator");

const {
    validateCardioLogId,
    validateCreateCardioLog,
    validateUpdateCardioLog,
} = require("../validators/cardioLogs.validator");
const checkWorkoutNotClosed = require("../middlewares/checkWorkoutNotClosed");
const { validateWorkoutId } = require("../validators/workouts.validator");
const { validateExerciseId } = require("../validators/exercises.validator");

// Crear registro de cardio
router.post(
    "/",
    validateWorkoutId, 
    validateExerciseId,
    checkWorkoutNotClosed,
    validateExerciseType("cardio"),
    validateCreateCardioLog,
    cardioLogsController.createCardioLog
);

// Obtener registro de cardio por ID
router.get(
    "/:cardioLogId",
    validateCardioLogId,
    cardioLogsController.getCardioLog
);

// Obtener todos los logs de cardio
router.get(
    "/",
    validateExerciseId, 
    validateWorkoutId,
    cardioLogsController.getAllCardioLogs
);

// Actualizar registro de cardio
router.patch(
    "/:cardioLogId",
    validateCardioLogId,
    checkWorkoutNotClosed,
    validateUpdateCardioLog,
    cardioLogsController.updateCardioLog
);

// Eliminar registro de cardio
router.delete(
    "/:cardioLogId",
    validateCardioLogId,
    checkWorkoutNotClosed,
    cardioLogsController.deleteCardioLog
);

module.exports = router;
