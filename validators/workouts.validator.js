const { body, query } = require("express-validator");
const { throwNotFoundError } = require("../errors/throwHTTPErrors");
const handleValidationErrors = require("./handleValidationErrors");
const { pool } = require("../initDB");
const { validateUUID } = require("./validator");

exports.validateWorkoutId = async (req, res, next) => {
    try {
        const workoutId =  req?.body?.workoutId || req?.params?.workoutId || req?.query?.workoutId;

        if (!validateUUID(workoutId)) {
            return throwNotFoundError("El ID del workout no es válido.");
        }

        const { rows } = await pool.query(
            `SELECT id, finished_at FROM workouts WHERE id = $1`,
            [workoutId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("El workout no existe.");
        }
        req.workout = rows[0];
        next();

    } catch (error) {
        next(error);
    }
};

exports.validateCreateWorkout = [
    body("routineId")
        .optional()
        .custom((value) => {
            if (value && !validateUUID(value)) {
                throw new Error("routineId debe ser un UUID válido.");
            }
            return true;
        }),
    body("name")
        .optional({ values: "falsy" })
        .isLength({ min: 2, max: 100 })
            .withMessage("El nombre debe tener entre 2 y 100 caracteres.")
            .trim(),   
    handleValidationErrors
];