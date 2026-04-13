const { body, query } = require("express-validator");
const { throwNotFoundError } = require("../errors/throwHTTPErrors");
const handleValidationErrors = require("./handleValidationErrors");
const { pool } = require("../initDB");
const { validateUUID } = require("./validator");

exports.validateExerciseId = async (req, res, next) => {
    try {
        const exerciseId =
            req.params?.exerciseId ||
            req.body?.exerciseId ||
            req.query?.exerciseId;
        
        if (!validateUUID(exerciseId)) {
            return throwNotFoundError("El ID del ejercicio no es válido.");
        }
        const { rows } = await pool.query(
            `SELECT * FROM exercises WHERE id = $1`,
            [exerciseId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("El ejercicio no existe.");
        }

        req.exercise = rows[0];
        next();

    } catch (error) {
        next(error);
    }
};

exports.validateCreateExercise = [
    body("name")
        .notEmpty().withMessage("El nombre es requerido.")
        .isLength({ min: 2, max: 100 })
        .withMessage("El nombre debe tener entre 2 y 100 caracteres.")
        .trim()
        .custom(async (value) => {
            const { rows } = await pool.query(
                `SELECT id FROM exercises WHERE LOWER(name) = LOWER($1)`,
                [value]
            );

            if (rows.length > 0) {
                throw new Error("Ya existe un ejercicio con ese nombre.");
            }

            return true;
        }),
    body("muscleGroup")
        .notEmpty().withMessage("Debe seleccionar un grupo muscular")
        .isIn([
            "pecho", 
            "espalda", 
            "hombros", 
            "biceps", 
            "triceps", 
            "antebrazos", 
            "cuadriceps", 
            "isquios", 
            "gluteos", 
            "gemelos", 
            "abs", 
            "cardio", 
            "full_body"
        ]).withMessage("El grupo muscular seleccionado no es válido"),
    body("equipment")
        .notEmpty().withMessage("Debe seleccionar un tipo de equipamiento")
        .isIn([
            "barras", 
            "mancuernas", 
            "maquinas", 
            "poleas", 
            "peso_corporal", 
            "bandas", 
            "kettlebells", 
            "ninguno"
        ]).withMessage("El tipo de equipamiento seleccionado no es válido"),
    body("type")
        .isIn(['strength', 'cardio'])
        .withMessage("El tipo de ejercicio debe ser fuerza o cardio."),
    handleValidationErrors
];

exports.validateUpdateExercise = [
    body("name")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("El nombre debe tener entre 2 y 100 caracteres.")
        .trim()
        .custom(async (value, { req }) => {
            const exerciseId = req.params.exerciseId;

            const { rows } = await pool.query(
                `SELECT id FROM exercises 
                 WHERE LOWER(name) = LOWER($1) 
                 AND id != $2`,
                [value, exerciseId]
            );

            if (rows.length > 0) {
                throw new Error("Ya existe otro ejercicio con ese nombre.");
            }

            return true;
        }),
    body("type")
        .optional()
        .isIn(['strength', 'cardio'])
        .withMessage("El tipo de ejercicio debe ser fuerza o cardio."),
    handleValidationErrors
];

exports.validateGetAllExercises = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page debe ser un número mayor a 0."),

    query("pageSize")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("PageSize debe estar entre 1 y 100."),

    query("type")
        .optional()
        .isIn(["strength", "cardio"])
        .withMessage("Tipo inválido."),

    query("name")
        .optional()
        .isString(),

    handleValidationErrors
];