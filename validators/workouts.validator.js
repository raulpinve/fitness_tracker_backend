const { body, query } = require("express-validator");
const { throwNotFoundError, throwConflictError, throwBadRequestError } = require("../errors/throwHTTPErrors");
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

exports.validateRoutineIdCampoOptional = async (req, res, next) => {
    try {
        const { routineId } = req.body;

        // Si no viene, sigue normal
        if (!routineId) return next();

        // Validar formato
        if (!validateUUID(routineId)) {
            return throwBadRequestError(undefined, "El ID de la rutina es incorrecto");
        }

        // Validar existencia
        const { rows } = await pool.query(
            `SELECT id FROM routines WHERE id = $1`,
            [routineId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("La rutina no existe");
        }

        next();
    } catch (error) {
        next(error);
    }
};

exports.validateCreateWorkout = [
    body("routineId")
        .optional()
        .custom(async(value) => {
            if (value && !validateUUID(value)) {
                throw new Error("routineId debe ser un UUID válido.");
            }
            // Check if the routine exits
        
            return true;
        }),
    body('startedAt')
        .exists().withMessage('La fecha es obligatoria')
        .isISO8601().withMessage('Formato de fecha inválido')
        .toDate(), // Convierte el string a un objeto Date de JS
        // .custom((value) => {
        //     const ahora = new Date();
        //     if (value < ahora) {
        //         throw new Error('La fecha no puede ser en el pasado');
        //     }
        //     return true;
        // })
    body("name")
        .optional({ values: "falsy" })
        .isLength({ min: 2, max: 100 })
            .withMessage("El nombre debe tener entre 2 y 100 caracteres.")
            .trim(),   
    handleValidationErrors
];