const { body } = require("express-validator");
const { throwNotFoundError, throwConflictError } = require("../errors/throwHTTPErrors");
const handleValidationErrors = require("./handleValidationErrors");
const { pool } = require("../initDB");
const { validateUUID } = require("./validator");

exports.validateRoutineExerciseId = async (req, res, next) => {
    try {
        const routineExerciseId = req.params.routineExerciseId;
        if (!validateUUID(routineExerciseId)) {
            return throwNotFoundError("El ID no es válido.");
        }
        const { rows } = await pool.query(
            `SELECT re.*, e.id as exercise_id, e.type as exercise_type 
                FROM routine_exercises re
                INNER JOIN exercises e
                ON re.exercise_id = e.id
                WHERE re.id = $1`,
            [routineExerciseId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("El ejercicio de la rutina no existe.");
        }
        req.exercise = {
            id: rows[0].exercise_id, 
            type: rows[0].exercise_type
        }
        next();
    } catch (error) {
        next(error);
    }
};

exports.validateCreateRoutineExercise = [
    body(["targetSets", "targetReps"])
        .if((value, { req }) => req.exercise.type === "strength")
        .notEmpty().withMessage("Este campo es obligatorio para ejercicios de fuerza.")
        .isInt({ min: 1 }).withMessage("Debe ser un número entero mayor a 0."),

    body("targetDurationSeconds")
        .if((value, { req }) => req.exercise.type === "cardio")
        .optional({ checkFalsy: true })
        .isInt({ min: 1 }).withMessage("La duración debe ser un número entero de segundos."),

    body("targetDistanceKm")
        .if((value, { req }) => req.exercise.type === "cardio")
        .optional({ checkFalsy: true })
        .isFloat({ min: 0.1 }).withMessage("La distancia debe ser un número mayor a 0."),

    body(["targetDurationSeconds", "targetDistanceKm"]).custom((value, { req }) => {
        if (req.exercise.type === "strength" && (value !== undefined && value !== "")) {
            throw new Error("No puedes asignar duración o distancia a un ejercicio de fuerza.");
        }
        return true;
    }),

    body(["targetSets", "targetReps"]).custom((value, { req }) => {
        if (req.exercise.type === "cardio" && (value !== undefined && value !== "")) {
            throw new Error("No puedes asignar series o repeticiones a un ejercicio de cardio.");
        }
        return true;
    }),

    body("targetDurationSeconds").custom((value, { req }) => {
        if (req.exercise.type === "cardio") {
            if (!req.body.targetDurationSeconds && !req.body.targetDistanceKm) {
                throw new Error("Para cardio, indica al menos una meta: duración o distancia.");
            }
        }
        return true;
    }),
    handleValidationErrors
];

exports.validateUpdateRoutineExercise = [
    body("targetSets")
        .if((value, { req }) => req.exercise.type === "strength")
        .optional()
        .isInt({ min: 1 }).withMessage("Las series deben ser un entero mayor a 0."),

    body("targetReps")
        .if((value, { req }) => req.exercise.type === "strength")
        .optional()
        .isInt({ min: 1 }).withMessage("Las repeticiones deben ser un entero mayor a 0."),

    body("targetDurationSeconds")
        .if((value, { req }) => req.exercise.type === "cardio")
        .optional()
        .isInt({ min: 1 }).withMessage("La duración debe ser un número entero de segundos."),

    body("targetDistanceKm")
        .if((value, { req }) => req.exercise.type === "cardio")
        .optional()
        .isFloat({ min: 0.1 }).withMessage("La distancia debe ser un número mayor a 0."),

    body(["targetDurationSeconds", "targetDistanceKm"]).custom((value, { req }) => {
        // Solo validamos si el valor tiene contenido real
        const hasValue = value !== undefined && value !== null && value !== "";
        
        if (req.exercise.type === "strength" && hasValue) {
            throw new Error("No se puede asignar duración o distancia a un ejercicio de fuerza.");
        }
        return true;
    }),

    body(["targetSets", "targetReps"]).custom((value, { req }) => {
        // Solo validamos si el valor tiene contenido real
        const hasValue = value !== undefined && value !== null && value !== "";

        if (req.exercise.type === "cardio" && hasValue) {
            throw new Error("No se puede asignar series o repeticiones a un ejercicio de cardio.");
        }
        return true;
    }),
    handleValidationErrors
];

exports.validateIfExerciseWasCreatedOnRoutine = async (req, res, next) => {
    try {
        const { routineId, exerciseId } = req.body;

        const query = 'SELECT id FROM routine_exercises WHERE routine_id = $1 AND exercise_id = $2';
        const result = await pool.query(query, [routineId, exerciseId]);

        if (result.rowCount > 0) {
            throwConflictError(undefined, "Este ejercicio ya existe en la rutina seleccionada.")
        }

        next();
    } catch (error) {
        next(error)
    }
}
