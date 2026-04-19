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

    // --- CAMBIO CLAVE: Validación de ARRAY de músculos ---
    body("muscleGroups")
        .toArray() // Convierte a array si llega como un solo string
        .isArray({ min: 1 }).withMessage("Debe seleccionar al menos un grupo muscular")
        .custom((values) => {
            const allowed = [
                'pecho', 'espalda', 'lumbares', 'hombros', 'biceps', 'triceps', 
                'antebrazos', 'cuadriceps', 'isquios', 'gluteos', 
                'gemelos', 'aductores', 'abs', 'cardio', 'full_body'
            ];
            // Verificamos que cada músculo enviado esté en la lista permitida
            return values.every(muscle => allowed.includes(muscle));
        })
        .withMessage("Uno o más grupos musculares seleccionados no son válidos"),

    body("equipment")
        .notEmpty().withMessage("Debe seleccionar un tipo de equipamiento")
        .isIn([
            "barras", "mancuernas", "maquinas", "poleas", "banco",
            "peso_corporal", "bandas", "kettlebells", "ninguno"
        ]).withMessage("El tipo de equipamiento seleccionado no es válido"),

    body("type")
        .isIn(['strength', 'cardio'])
        .withMessage("El tipo de ejercicio debe ser fuerza o cardio."),

    body('description')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 1500 }) 
        .withMessage('Descripción demasiado larga')
        .customSanitizer(value => {
            return value.replace(/<[^>]*>/g, '');
        }),

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

    body("muscleGroups")
        .optional()
        .customSanitizer(value => {
            // Normalizamos: siempre devolver un array para el validador
            if (typeof value === 'string') return [value];
            return value;
        })
        .isArray({ min: 1 }).withMessage("Debe seleccionar al menos un grupo muscular")
        .custom((values) => {
            const allowed = [
                'pecho', 'espalda', 'lumbares', 'hombros', 'biceps', 'triceps', 
                'antebrazos', 'cuadriceps', 'isquios', 'gluteos', 
                'gemelos', 'aductores', 'abs', 'cardio', 'full_body'
            ];
            return values.every(muscle => allowed.includes(muscle));
        })
        .withMessage("Uno o más grupos musculares seleccionados no son válidos"),

    body("equipment")
        .optional()
        .isIn([
            "barras", "mancuernas", "maquinas", "poleas", "banco",
            "peso_corporal", "bandas", "kettlebells", "ninguno"
        ]).withMessage("El tipo de equipamiento seleccionado no es válido"),

    body("type")
        .optional()
        .isIn(['strength', 'cardio'])
        .withMessage("El tipo de ejercicio debe ser fuerza o cardio."),

    body('description')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 1500 }) 
        .withMessage('Descripción demasiado larga')
        .customSanitizer(value => {
            return value.replace(/<[^>]*>/g, '');
        }),

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