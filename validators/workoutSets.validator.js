const { body, query } = require("express-validator");
const { throwNotFoundError } = require("../errors/throwHTTPErrors");
const handleValidationErrors = require("./handleValidationErrors");
const { pool } = require("../initDB");
const { validateUUID } = require("./validator");

exports.validateWorkoutSetId = async (req, res, next) => {
    try {
        const workoutSetId = req?.params?.workoutSetId;
        if (!validateUUID(workoutSetId)) {
            return throwNotFoundError("El ID del set no es válido.");
        }

        const { rows } = await pool.query(
            `SELECT ws.id, w.finished_at 
                FROM workout_sets as ws 
                INNER JOIN workout_exercises as we
                    ON we.id = ws.workout_exercise_id
                INNER JOIN workouts as w 
                    ON w.id = we.workout_id
                WHERE ws.id = $1`,
            [workoutSetId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("El set no existe.");
        }

        req.workout = {
            finishedAt: rows[0].finished_at
        }

        next();
    } catch (error) {
        next(error);
    }
};

exports.validateCreateWorkoutSet = [
    body("reps")
        .notEmpty().withMessage("reps es requerido.")
        .isInt({ min: 1 })
        .withMessage("reps debe ser un entero mayor a 0."),

    body("weight")
        .notEmpty().withMessage("El campo es requerido.")
        .isFloat({ min: 0 })
        .withMessage("weight debe ser un número mayor o igual a 0."),
    
    body("weightUnit")
        .notEmpty().withMessage("El campo es requerido.")
        .isIn(["kg", "lb"]),

    handleValidationErrors
];

exports.validateUpdateWorkoutSet = [
    body("reps")
        .optional()
        .isInt({ min: 1 })
        .withMessage("reps debe ser un entero mayor a 0."),

    body("weight")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("weight debe ser un número mayor o igual a 0."),
    
    body("weightUnit")
        .notEmpty().withMessage("El campo es requerido.")
        .isFloat({ min: 0 })
        .withMessage("weight debe ser un número mayor o igual a 0."),

    handleValidationErrors
];