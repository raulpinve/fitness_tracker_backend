const { uuidv7 } = require("uuidv7");
const { throwBadRequestError, throwNotFoundError, throwConflictError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createWorkoutExercise = async (req, res, next) => {
    try {
        const { workoutId, exerciseId } = req.body;
        const { rows } = await pool.query(
            `INSERT INTO workout_exercises (
                id,
                workout_id,
                exercise_id
            )
            VALUES ($1,$2,$3)
            RETURNING *`,
            [
                uuidv7(),
                workoutId,
                exerciseId
            ]
        );
        return res.status(201).json({
            statusCode: 201,
            status: "success",
            data: snakeToCamel(rows[0])
        });

    } catch (error) {
        if (error.code === '23505') { 
            throwConflictError(undefined, "Este ejercicio ya ha sido añadido a la sesión.")
        }
    next(error);
        next(error);
    }
};

exports.getWorkoutExercise = async (req, res, next) => {
    try {
        const { workoutExerciseId } = req.params;

        const { rows } = await pool.query(
            `SELECT we.*, e.name as exercise_name
                FROM workout_exercises as we
                JOIN exercises as e 
                ON e.id = we.exercise_id
             WHERE we.id = $1`,
            [workoutExerciseId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Workout exercise no encontrado.");
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

exports.getWorkoutExercises = async (req, res, next) => {
    try {
        const { workoutId } = req.query;
        if (!workoutId) {
            return throwBadRequestError(undefined, "workoutId es requerido.");
        }

        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const { rows } = await pool.query(
            `SELECT 
                we.id as workout_exercise_id,
                we.workout_id,
                we.exercise_id,
                we.created_at,
                e.name as exercise_name,
                e.avatar as exercise_avatar,
                e.avatar_thumbnail as exercise_avatar_thumbnail,
                e.video_url as exercise_video_url,
                e.type as exercise_type
             FROM workout_exercises AS we
             INNER JOIN exercises AS e
                ON we.exercise_id = e.id
             WHERE we.workout_id = $1
             ORDER BY we.created_at ASC
             LIMIT $2 OFFSET $3`,
            [
                workoutId,
                pageSize,
                offset
            ]
        );

        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*)
             FROM workout_exercises
             WHERE workout_id = $1`,
            [workoutId]
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

exports.deleteWorkoutExercise = async (req, res, next) => {
    try {
        const { workoutExerciseId } = req.params;

        const { rows } = await pool.query(
            `DELETE FROM workout_exercises
             WHERE id = $1
             RETURNING *`,
            [workoutExerciseId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("Workout exercise no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Ejercicio eliminado del workout."
        });

    } catch (error) {
        next(error);
    }
};