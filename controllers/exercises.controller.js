const { uuidv7 } = require("uuidv7");
const { throwBadRequestError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createExercise = async (req, res, next) => {
    try {
        const { name, type } = req.body;
        if (!name) {
            return throwBadRequestError("El nombre es requerido.");
        }
        const { rows } = await pool.query(
            `INSERT INTO exercises (id, name, type)
             VALUES ($1, $2, $3)
             RETURNING id, name, type`,
            [
                uuidv7(),
                name,
                type
            ]
        );

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            data: snakeToCamel(rows[0])
        });

    } catch (error) {
        next(error);
    }
};

exports.getExercise = async (req, res, next) => {
    try {
        const { exerciseId } = req.params;

        const { rows } = await pool.query(
            `SELECT id, name, avatar, avatar_thumbnail, video_url, type
             FROM exercises
             WHERE id = $1`,
            [exerciseId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("Ejercicio no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            data: snakeToCamel(rows[0])
        });

    } catch (error) {
        next(error);
    }
};

exports.getAllExercises = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const name = req.query.name || null;

        const query = `
            SELECT id, name, avatar, avatar_thumbnail, video_url, type
            FROM exercises
            WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
            ORDER BY name
            LIMIT $2 OFFSET $3
        `;

        const { rows } = await pool.query(query, [
            name,
            pageSize,
            offset
        ]);

        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*)
             FROM exercises
             WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')`,
            [name]
        );

        const totalRecords = parseInt(totalRows[0].count);
        const totalPages = Math.ceil(totalRecords / pageSize);

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords 
            },
            data: rows.map(snakeToCamel)
        });

    } catch (error) {
        next(error);
    }
};

exports.updateExercise = async (req, res, next) => {
    try {
        const { exerciseId } = req.params;
        const { name, type } = req.body || {};

        const { rows } = await pool.query(
            `UPDATE exercises
             SET name = COALESCE($1, name),
              type = COALESCE($2, type)
             WHERE id = $3
             RETURNING id, name, type`,
            [name, type, exerciseId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("Ejercicio no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Ejercicio actualizado exitosamente.",
            data: snakeToCamel(rows[0])
        });

    } catch (error) {
        next(error);
    }
};

exports.deleteExercise = async (req, res, next) => {
    try {
        const { exerciseId } = req.params;
        const { rowCount } = await pool.query(
            `DELETE FROM exercises WHERE id = $1`,
            [exerciseId]
        );
        if (rowCount === 0) {
            return throwNotFoundError("Ejercicio no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Ejercicio eliminado exitosamente."
        });

    } catch (error) {
        next(error);
    }
};