const { uuidv7 } = require("uuidv7");
const { throwUnauthorizedError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { compareHashedPassword, generateAccessToken, generateRefreshToken } = require("../utils/hash.helper");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

exports.register = async (req, res, next) => {
    try {
        const { firstName, lastName, username, email, password } = req.body;

        if (!firstName || !lastName || !username || !email || !password) {
            return throwBadRequestError("Todos los campos son obligatorios.");
        }

        // Validaciones de unicidad
        const { rows: existingUsername } = await pool.query(
            `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
            [username]
        );

        if (existingUsername.length > 0) {
            return throwBadRequestError("El username ya está en uso.");
        }

        const { rows: existingEmail } = await pool.query(
            `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
            [email]
        );

        if (existingEmail.length > 0) {
            return throwBadRequestError("El email ya está en uso.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario
        const { rows } = await pool.query(
            `INSERT INTO users (
                id, first_name, last_name, username, email, password
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username`,
            [
                uuidv7(),
                firstName.trim(),
                lastName.trim(),
                username.trim(),
                email.toLowerCase().trim(),
                hashedPassword
            ]
        );

        const newUser = rows[0];

        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);

        const newHash = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        await pool.query(
            `INSERT INTO sessions
                (id, user_id, refresh_token_hash, expiration_date)
             VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
            [uuidv7(), newUser.id, newHash]
        );

        res.cookie("refresh_token", refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            message: "Usuario registrado.",
            data: {
                accessToken
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        const { rows } = await pool.query(
            `SELECT id, password, username 
             FROM users
             WHERE LOWER(username) = LOWER($1)`,
            [username]
        );

        const userFound = rows[0];
        if (!userFound) {
            throwUnauthorizedError("El usuario o la contraseña no son correctas.");
        }

        if (!compareHashedPassword(password, userFound.password)) {
            throwUnauthorizedError("El usuario o la contraseña no son correctas.");
        }
        const accessToken = generateAccessToken(userFound);
        const refreshToken = generateRefreshToken(userFound); 

        // Guardar sesión
        const newHash = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        await pool.query(
            `INSERT INTO sessions
                (id, user_id, refresh_token_hash, expiration_date)
                VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
            [uuidv7(), userFound.id, newHash]
        );

        res.cookie("refresh_token", refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({
            statusCode: 200,
            status: "success",
            message: "Inicio de sesión exitoso.",
            data: {
                accessToken
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.logout = async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refresh_token;

        if (refreshToken) {
            const hashed = crypto
                .createHash("sha256")
                .update(refreshToken)
                .digest("hex");

            await pool.query(
                `DELETE FROM sessions WHERE refresh_token_hash = $1`,
                [hashed]
            );
        }

        res.clearCookie("refresh_token", {
            httpOnly: true,
            secure: false, // en dev
            sameSite: "lax"
        });

        return res.json({
            status: "success",
            message: "Sesión cerrada correctamente"
        });

    } catch (error) {
        next(error);
    }
};

exports.authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader) throwUnauthorizedError("No autorizado.");

        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : authHeader;

        let payload;

        try {
            payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        } catch (error) {
            throwUnauthorizedError("Token inválido o expirado.");
        }

        const { rows } = await pool.query(
            `SELECT id FROM users
             WHERE id = $1`,
            [payload.id]
        );

        if(rows.length === 0) {
            throwUnauthorizedError("Usuario no encontrado.");
        }

        req.user = {
            id: rows[0].id,
        };
        next();

    } catch (error) {
        next(error);
    }
};

exports.refreshToken = async (req, res, next) => {
    const client = await pool.connect();

    try {
        const refreshToken = req.cookies.refresh_token; 

        if (!refreshToken) throwUnauthorizedError("No autorizado.");

        const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        const hash = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        await client.query("BEGIN");

        const { rows: session } = await client.query(
            `SELECT * FROM sessions
             WHERE refresh_token_hash = $1
             AND revoked = false
             AND expiration_date > NOW()`,
            [hash]
        );
        if (session.length === 0) {
            throwUnauthorizedError("No autorizado.");
        }

        // Revocar token viejo
        await client.query(
            `UPDATE sessions 
             SET revoked = true
             WHERE refresh_token_hash = $1`,
            [hash]
        );

        // Generar nuevos tokens
        const newAccessToken = generateAccessToken({ id: payload.id });
        const newRefreshToken = generateRefreshToken({ id: payload.id });

        const newHash = crypto
            .createHash("sha256")
            .update(newRefreshToken)
            .digest("hex");

        // Guardar nueva sesión
        await client.query(
            `INSERT INTO sessions (id, user_id, refresh_token_hash, expiration_date)
                VALUES ($1,$2, $3,NOW() + INTERVAL '7 days')`,
            [uuidv7(), payload.id, newHash]
        );

        await client.query("COMMIT");

        // nueva cookie
        res.cookie("refresh_token", newRefreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({
            statusCode: 200,
            status: "success",
            data: {
                accessToken: newAccessToken
            }
        });

    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
};


exports.me = async (req, res, next) => {
    try {
        const userId = req.usuario.id;

        // Obtener información del usuario
        const { rows } = await pool.query(`
            SELECT id, first_name, last_name, username, email FROM users
            WHERE id = $1 AND deleted_at IS NULL
        `, [userId]);

        const user = rows[0];
        if (!user) {
            throwUnauthorizedError("El usuario no existe o fue eliminado.");
        }

        return res.json({
            statusCode: 200,
            status: "success",
            data: {
                id: user.id,
                firstName: user.first_name,
                middleName: user.middle_name,
                lastName: user.last_name,
                secondLastName: user.second_last_name,
                username: user.username,
                email: user.email,
                emailVerified: user.email_verified,
                companyId: user.company_id,
                role: user.role,
            }
        });

    } catch (error) {
        next(error);
    }
};
