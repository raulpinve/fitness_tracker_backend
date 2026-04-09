const { uuidv7 } = require("uuidv7");
const { throwBadRequestError, throwNotFoundError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createRoutine = async (req, res, next) => {
    try {
        const { name } = req.body;
        const { id: userId } = req.user || {};

        if (!userId) {
            return throwBadRequestError("El userId es requerido.");
        }

        if (!name) {
            return throwBadRequestError("El nombre es requerido.");
        }

        const { rows } = await pool.query(
            `INSERT INTO routines (id, user_id, name)
             VALUES ($1, $2, $3)
             RETURNING id, name`,
            [
                uuidv7(),
                userId,
                name
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

exports.getRoutine = async (req, res, next) => {
    try {
        const { routineId } = req.params;

        const { rows } = await pool.query(
            `SELECT id,  name
             FROM routines
             WHERE id = $1`,
            [routineId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Rutina no encontrada.");
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

exports.getAllRoutines = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const name = req.query.name || null;
        const userId = req.query.userId || null;

        const query = `
            SELECT id, name
            FROM routines
            WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
              AND ($2::uuid IS NULL OR user_id = $2)
            ORDER BY name
            LIMIT $3 OFFSET $4
        `;

        const { rows } = await pool.query(query, [
            name,
            userId,
            pageSize,
            offset
        ]);

        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*)
             FROM routines
             WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
               AND ($2::uuid IS NULL OR user_id = $2)`,
            [name, userId]
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

exports.updateRoutine = async (req, res, next) => {
    try {
        const { routineId } = req.params;
        const { name } = req.body || {};

        if (!name) {
            return throwBadRequestError("Debe enviar al menos un campo para actualizar.");
        }

        const { rows } = await pool.query(
            `UPDATE routines
             SET name = COALESCE($1, name)
             WHERE id = $2
             RETURNING id, user_id, name`,
            [name, routineId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Rutina no encontrada.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Rutina actualizada exitosamente.",
            data: snakeToCamel(rows[0])
        });

    } catch (error) {
        next(error);
    }
};

exports.deleteRoutine = async (req, res, next) => {
    try {
        const { routineId } = req.params;

        const { rowCount } = await pool.query(
            `DELETE FROM routines WHERE id = $1`,
            [routineId]
        );

        if (rowCount === 0) {
            return throwNotFoundError("Rutina no encontrada.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Rutina eliminada exitosamente."
        });

    } catch (error) {
        next(error);
    }
};

exports.cloneRoutine = async (req, res, next) => {
    const client = await pool.connect();

    try {
        const { routineId } = req.params;

        await client.query("BEGIN");

        // 1. Obtener rutina original
        const { rows: routineRows } = await client.query(
            `SELECT *
             FROM routines
             WHERE id = $1`,
            [routineId]
        );

        if (routineRows.length === 0) {
            throwNotFoundError("La rutina no existe.");
        }

        const originalRoutine = routineRows[0];

        // 2. Desactivar rutina actual
        await client.query(
            `UPDATE routines
             SET is_active = false
             WHERE id = $1`,
            [routineId]
        );

        // 3. Crear nueva rutina
        const newRoutineId = uuidv7();

        const { rows: newRoutineRows } = await client.query(
            `INSERT INTO routines (id, name, user_id, is_active)
             VALUES ($1, $2, $3, true)
             RETURNING *`,
            [
                newRoutineId,
                originalRoutine.name + " duplicada",
                originalRoutine.user_id
            ]
        );

        // 4. Obtener ejercicios de la rutina original
        const { rows: exercises } = await client.query(
            `SELECT *
             FROM routine_exercises
             WHERE routine_id = $1`,
            [routineId]
        );

        // 5. Insertar ejercicios en la nueva rutina
        for (const ex of exercises) {
            await client.query(
                `INSERT INTO routine_exercises (
                    id,
                    routine_id,
                    exercise_id,
                    target_sets,
                    target_reps,
                    target_duration_seconds,
                    target_distance_km,
                    order_index
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [
                    uuidv7(),
                    newRoutineId,
                    ex.exercise_id,
                    ex.target_sets,
                    ex.target_reps,
                    ex.target_duration_seconds,
                    ex.target_distance_km,
                    ex.order_index
                ]
            );
        }

        await client.query("COMMIT");

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            message: "Rutina clonada exitosamente.",
            data: snakeToCamel(newRoutineRows[0])
        });

    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
};