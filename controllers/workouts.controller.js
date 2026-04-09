const { uuidv7 } = require("uuidv7");
const { throwBadRequestError, throwNotFoundError, throwConflictError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createWorkout = async (req, res, next) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { routineId } = req.body  || {};
        const { id: userId } = req.user;

        if (!userId) {
            return throwBadRequestError("userId es requerido.");
        }

        const { rows: rowsWorkout } = await client.query(
            `INSERT INTO workouts (
                id,
                user_id,
                routine_id,
                started_at
            )
            VALUES ($1, $2, $3, NOW())
            RETURNING *`,[
                uuidv7(),
                userId,
                routineId || null
            ]
        );


        // If the routine exists, create the workout exercise based on it
        if (routineId) {
            const workoutId = rowsWorkout[0].id;

            await client.query(
                `
                INSERT INTO workout_exercises (
                    id,
                    workout_id,
                    exercise_id
                )
                SELECT 
                    $1,
                    $2,
                    re.exercise_id
                FROM routine_exercises re
                WHERE re.routine_id = $3
                `,
                [uuidv7(), workoutId, routineId]
            );
        }

        await client.query("COMMIT");

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            data: snakeToCamel(rowsWorkout[0])
        });

    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
};

exports.getWorkout = async (req, res, next) => {
    try {
        const { workoutId } = req.params;

        const { rows } = await pool.query(
            `SELECT *
             FROM workouts
             WHERE id = $1`,
            [workoutId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Workout no encontrado.");
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

exports.getAllWorkouts = async (req, res, next) => {
    try {
        const { id: userId } = req.user;
        if (!userId) {
            return throwBadRequestError("userId es requerido.");
        }

        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const query = `
            SELECT *
            FROM workouts
            WHERE user_id = $1
            ORDER BY started_at DESC
            LIMIT $2 OFFSET $3
        `;

        const { rows } = await pool.query(query, [userId, pageSize, offset]);
        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*) FROM workouts WHERE user_id = $1`,
            [userId]
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

exports.finishWorkout = async (req, res, next) => {
    try {
        const { workoutId } = req.params;
        if(req.workout.finished_at){
            throwConflictError(undefined, "El workout ya se encuentra finalizado")
        }

        const { rows } = await pool.query(
            `UPDATE workouts
             SET finished_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [workoutId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("Workout no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Workout finalizado.",
            data: snakeToCamel(rows[0])
        });

    } catch (error) {
        next(error);
    }
};

exports.deleteWorkout = async (req, res, next) => {
    try {
        const { workoutId } = req.params;

        const { rowCount } = await pool.query(
            `DELETE FROM workouts WHERE id = $1`,
            [workoutId]
        );

        if (rowCount === 0) {
            return throwNotFoundError("Workout no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Workout eliminado."
        });

    } catch (error) {
        next(error);
    }
};