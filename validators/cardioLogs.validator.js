const { body } = require("express-validator");
const { throwNotFoundError } = require("../errors/throwHTTPErrors");
const handleValidationErrors = require("./handleValidationErrors");
const { pool } = require("../initDB");
const { validateUUID } = require("./validator");

exports.validateCardioLogId = async (req, res, next) => {
    try {
        const { cardioLogId } = req.params;
        if (!validateUUID(cardioLogId)) {
            return throwNotFoundError("El ID del registro de cardio no es válido.");
        }

        const { rows } = await pool.query(
            `SELECT cl.id, w.finished_at 
                FROM cardio_logs as cl
                INNER JOIN workout_exercises AS we
                    ON we.id = cl.workout_exercise_id
                INNER JOIN workouts as w
                    ON we.workout_id = w.id
                WHERE cl.id = $1`,
            [cardioLogId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("El registro de cardio no existe.");
        }

        req.workout = {
            finishedAt: rows[0].finished_at
        }

        next();
    } catch (error) {
        next(error);
    }
};

exports.validateCreateCardioLog = [
    body("durationSeconds")
        .notEmpty().withMessage("El campo es requerido.")
        .isInt({ min: 1 })
        .withMessage("La duración debe ser un entero mayor a 0 segundos."),

    body("distanceKm")
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage("La distancia debe ser un número mayor o igual a 0."),

    body("calories")
        .optional({ nullable: true })
        .isInt({ min: 0 })
        .withMessage("Las calorías deben ser un número entero mayor o igual a 0."),

    body("avgHeartRate")
        .optional({ nullable: true })
        .isInt({ min: 30, max: 250 })
        .withMessage("El ritmo cardíaco debe estar en un rango válido (30-250)."),

    handleValidationErrors
];

exports.validateUpdateCardioLog = [
    body("durationSeconds")
        .optional()
        .isInt({ min: 1 })
        .withMessage("La duración debe ser un entero mayor a 0 segundos."),

    body("distanceKm")
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage("La distancia debe ser un número mayor o igual a 0."),

    body("calories")
        .optional({ nullable: true })
        .isInt({ min: 0 })
        .withMessage("Las calorías deben ser un número entero mayor o igual a 0."),

    body("avgHeartRate")
        .optional({ nullable: true })
        .isInt({ min: 30, max: 250 })
        .withMessage("El ritmo cardíaco debe estar en un rango válido."),

    handleValidationErrors
];
