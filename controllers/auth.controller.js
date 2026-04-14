const { uuidv7 } = require("uuidv7");
const { throwUnauthorizedError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { compareHashedPassword, generateAccessToken, generateRefreshToken } = require("../utils/hash.helper");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { snakeToCamel } = require("../utils/utils.helper");

exports.register = async (req, res, next) => {
    try {
        const { firstName, lastName, username, email, password } = req.body;

        if (!firstName || !lastName || !username || !email || !password) {
            return throwBadRequestError("Todos los campos son obligatorios.");
        }

        // Validaciones de unicidad (Username)
        const { rows: existingUsername } = await pool.query(
            `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
            [username]
        );
        if (existingUsername.length > 0) return throwBadRequestError("El username ya está en uso.");

        // Validaciones de unicidad (Email)
        const { rows: existingEmail } = await pool.query(
            `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
            [email]
        );
        if (existingEmail.length > 0) return throwBadRequestError("El email ya está en uso.");

        const hashedPassword = await bcrypt.hash(password, 10);

        // 1. CREAR USUARIO (Devolvemos los campos necesarios para el perfil)
        const { rows } = await pool.query(
            `INSERT INTO users (id, first_name, last_name, username, email, password)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, first_name, last_name, username, email`,
            [
                uuidv7(),
                firstName.trim(),
                lastName.trim(),
                username.trim(),
                email.toLowerCase().trim(),
                hashedPassword
            ]
        );

        // Convertimos a camelCase usando la utilidad snakeToCamel
        const newUser = snakeToCamel(rows[0]);

        // 2. GENERAR TOKENS
        const accessToken = generateAccessToken({ id: newUser.id });
        const refreshToken = generateRefreshToken({ id: newUser.id });

        const newHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        // 3. GUARDAR SESIÓN
        await pool.query(
            `INSERT INTO sessions (id, user_id, refresh_token_hash, expiration_date)
             VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
            [uuidv7(), newUser.id, newHash]
        );

        // 4. CONFIGURAR COOKIE
        res.cookie("refresh_token", refreshToken, {
            httpOnly: true,
            secure: false, // true en prod
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // 5. RESPUESTA COMPLETA (Incluyendo el usuario)
        return res.status(201).json({
            statusCode: 201,
            status: "success",
            message: "Usuario registrado.",
            data: {
                accessToken,
                user: newUser // Ahora el frontend recibe firstName, lastName, etc.
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        // 1. OBTENER INFORMACIÓN COMPLETA (Añadimos first_name, last_name, email)
        const { rows } = await pool.query(
            `SELECT id, password, username, first_name, last_name, email, avatar, avatar_thumbnail
             FROM users
             WHERE LOWER(username) = LOWER($1)`,
            [username]
        );

        const userFound = rows[0];
        if (!userFound) {
            throwUnauthorizedError("El usuario o la contraseña no son correctas.");
        }

        // 2. VERIFICAR CONTRASEÑA
        if (!compareHashedPassword(password, userFound.password)) {
            throwUnauthorizedError("El usuario o la contraseña no son correctas.");
        }

        // 3. GENERAR TOKENS
        const accessToken = generateAccessToken({ id: userFound.id });
        const refreshToken = generateRefreshToken({ id: userFound.id }); 

        // 4. GUARDAR SESIÓN
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

        // 5. LIMPIAR OBJETO PARA EL FRONTEND (Quitamos el password y normalizamos)
        const { password: _, ...userDataRaw } = userFound;
        const user = snakeToCamel(userDataRaw);

        // 6. CONFIGURAR COOKIE
        res.cookie("refresh_token", refreshToken, {
            httpOnly: true,
            secure: false, // true en prod
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // 7. RESPUESTA DINÁMICA
        return res.json({
            statusCode: 200,
            status: "success",
            message: "Inicio de sesión exitoso.",
            data: {
                accessToken,
                user // Ahora el frontend tiene firstName, lastName, etc.
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

            // En lugar de borrar, marcamos como revocado (o borramos, si prefieres tabla limpia)
            await pool.query(
                `UPDATE sessions SET revoked = true WHERE refresh_token_hash = $1`,
                [hashed]
            );
        }

        // IMPORTANTE: Limpia la cookie con las mismas opciones que la creaste
        res.clearCookie("refresh_token", {
            httpOnly: true,
            secure: false, // Cambiar a true en producción
            sameSite: "lax",
            path: "/" // Asegúrate de que el path sea el mismo
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

        if (!refreshToken) {
            return res.status(401).json({ statusCode: 401, message: "No autorizado." });
        }

        const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        const hash = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        await client.query("BEGIN");

        // Validar sesión activa
        const { rows: session } = await client.query(
            `SELECT * FROM sessions
             WHERE refresh_token_hash = $1
             AND revoked = false
             AND expiration_date > NOW()`,
            [hash]
        );

        if (session.length === 0) {
            await client.query("ROLLBACK");
            return res.status(401).json({ statusCode: 401, message: "Sesión inválida o expirada." });
        }

        // 1. OBTENER INFORMACIÓN DEL USUARIO
        const { rows: userRows } = await client.query(
            `SELECT id, first_name, last_name, username, email, avatar, avatar_thumbnail 
             FROM users WHERE id = $1`,
            [payload.id]
        );

        if (userRows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(401).json({ statusCode: 401, message: "Usuario no encontrado." });
        }

        // Convertimos el usuario a camelCase inmediatamente
        const userData = snakeToCamel(userRows[0]);

        // 2. REVOCAR TOKEN VIEJO
        await client.query(
            `UPDATE sessions 
             SET revoked = true
             WHERE refresh_token_hash = $1`,
            [hash]
        );

        // 3. GENERAR NUEVOS TOKENS
        const newAccessToken = generateAccessToken({ id: payload.id });
        const newRefreshToken = generateRefreshToken({ id: payload.id });

        const newHash = crypto
            .createHash("sha256")
            .update(newRefreshToken)
            .digest("hex");

        // 4. GUARDAR NUEVA SESIÓN
        await client.query(
            `INSERT INTO sessions (id, user_id, refresh_token_hash, expiration_date)
             VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
            [uuidv7(), payload.id, newHash]
        );

        await client.query("COMMIT");

        // Configurar nueva cookie
        res.cookie("refresh_token", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // Solo true en producción
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Respuesta final con datos en camelCase
        return res.json({
            statusCode: 200,
            status: "success",
            data: {
                accessToken: newAccessToken,
                user: userData // Ya viene formateado como firstName, lastName, etc.
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
