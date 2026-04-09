const { body } = require("express-validator");
const { pool } = require("../initDB");
const handleValidationErrors = require("./handleValidationErrors");

const validatePassword = () => [
    body("password")
        .matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-\={}[\]:;"'<>,.?\\/]).{8,20}$/)
        .withMessage(
            "La contraseña debe tener al menos una letra mayúscula, un número, un carácter especial y tener entre 8 y 20 caracteres."
        ),
];

const validateUsernameFormat = () => [
    body("username")
        .notEmpty().withMessage("Debe proporcionar un username.")
        .matches(/^[a-zA-Z0-9_]{3,20}$/)
        .withMessage("El username debe tener entre 3 y 20 caracteres y solo puede contener letras, números y guiones bajos.")
];

const validateUsernameUnique = () => [
    body("username").custom(async (value) => {
        const { rows } = await pool.query(
            `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
            [value]
        );

        if (rows.length > 0) {
            throw new Error("El username ya está en uso.");
        }

        return true;
    })
];

const validateEmail = () => [
    body("email")
        .notEmpty().withMessage("Debe proporcionar un email.")
        .isEmail().withMessage("Debe ser un email válido.")
        .normalizeEmail()
        .custom(async (value) => {
            const { rows } = await pool.query(
                `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
                [value]
            );

            if (rows.length > 0) {
                throw new Error("El email ya está en uso.");
            }

            return true;
        })
];

const validateFirstName = () => [
    body("firstName")
        .notEmpty().withMessage("Debe proporcionar el nombre.")
        .isLength({ min: 2, max: 50 })
        .withMessage("El nombre debe tener entre 2 y 50 caracteres.")
        .trim()
];

const validateLastName = () => [
    body("lastName")
        .notEmpty().withMessage("Debe proporcionar el apellido.")
        .isLength({ min: 2, max: 50 })
        .withMessage("El apellido debe tener entre 2 y 50 caracteres.")
        .trim()
];

exports.validateLogin = [
    ...validateUsernameFormat(),
    ...validatePassword(),
    handleValidationErrors
];

exports.validateRegister = [
    ...validateFirstName(),
    ...validateLastName(),
    ...validateUsernameFormat(),
    ...validateUsernameUnique(),
    ...validateEmail(),
    ...validatePassword(),
    handleValidationErrors
];