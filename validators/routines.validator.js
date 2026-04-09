const { body, query } = require("express-validator");
const { throwNotFoundError } = require("../errors/throwHTTPErrors");
const handleValidationErrors = require("./handleValidationErrors");
const { pool } = require("../initDB");
const { validateUUID } = require("./validator");

exports.validateRoutineId = async (req, res, next) => {
    try {
        const routineId = req.params.routineId || req.body.routineId || req.query.routineId;
        if (!validateUUID(routineId)) {
            return throwNotFoundError("El ID de la rutina no es válido.");
        }

        const { rows } = await pool.query(
            `SELECT id FROM routines WHERE id = $1`,
            [routineId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("La rutina no existe.");
        }

        next();

    } catch (error) {
        next(error);
    }
};

exports.validateCreateRoutine = [
    body("name")
        .notEmpty().withMessage("El nombre es requerido.")
        .isLength({ min: 2, max: 100 })
        .withMessage("El nombre debe tener entre 2 y 100 caracteres.")
        .trim()
        .custom(async (value) => {
            const { rows } = await pool.query(
                `SELECT id FROM routines WHERE LOWER(name) = LOWER($1)`,
                [value]
            );

            if (rows.length > 0) {
                throw new Error("Ya existe una rutina con ese nombre.");
            }

            return true;
        }),

    handleValidationErrors
];

exports.validateUpdateRoutine = [
    body("name")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("El nombre debe tener entre 2 y 100 caracteres.")
        .trim()
        .custom(async (value, { req }) => {
            const routineId = req.params.routineId;

            const { rows } = await pool.query(
                `SELECT id FROM routines 
                 WHERE LOWER(name) = LOWER($1)
                 AND id != $2`,
                [value, routineId]
            );

            if (rows.length > 0) {
                throw new Error("Ya existe otra rutina con ese nombre.");
            }

            return true;
        }),

    handleValidationErrors
];

exports.validateGetAllRoutines = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page debe ser un número mayor a 0."),

    query("pageSize")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("PageSize debe estar entre 1 y 100."),

    query("name")
        .optional()
        .isString(),

    query("userId")
        .optional()
        .custom((value) => {
            if (!validateUUID(value)) {
                throw new Error("El userId debe ser un UUID válido.");
            }
            return true;
        }),

    handleValidationErrors
];