const { uuidv7 } = require("uuidv7");
const { throwBadRequestError, throwNotFoundError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createRoutineExercise = async (req, res, next) => {
    try {
        const {
            routineId,
            exerciseId,
            targetSets,
            targetReps,
            targetDurationSeconds,
            targetDistanceKm
        } = req.body;

        if (!routineId || !exerciseId) {
            return throwBadRequestError("routineId y exerciseId son requeridos.");
        }

        const { rows } = await pool.query(
            `INSERT INTO routine_exercises (
                id,
                routine_id,
                exercise_id,
                target_sets,
                target_reps,
                target_duration_seconds,
                target_distance_km
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *`,
            [
                uuidv7(),
                routineId,
                exerciseId,
                targetSets || null,
                targetReps || null,
                targetDurationSeconds || null,
                targetDistanceKm || null
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

exports.getRoutineExercise = async (req, res, next) => {
    try {
        const { routineExerciseId } = req.params;
        const { rows } = await pool.query(
            `SELECT re.*, e.name as exercise_name
             FROM routine_exercises re
             INNER JOIN exercises as e
             ON e.id = re.exercise_id
             WHERE re.id = $1`,
            [routineExerciseId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("Ejercicio de rutina no encontrado.");
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

exports.getRoutineExercises = async (req, res, next) => {
    try {
        const { routineId } = req.params;
        if (!routineId) {
            return throwBadRequestError("routineId es requerido.");
        }

        const { rows } = await pool.query(
            `SELECT re.*, e.name as exercise_name
             FROM routine_exercises as re
             INNER JOIN exercises as e
             ON e.id = re.exercise_id
             WHERE re.routine_id = $1`,
            [routineId]
        );
        return res.status(200).json({
            statusCode: 200,
            status: "success",
            data: rows.map(snakeToCamel)
        });
    } catch (error) {
        next(error);
    }
};

exports.updateRoutineExercise = async (req, res, next) => {
    try {
        const { routineExerciseId } = req.params;
        const {
            targetSets,
            targetReps,
            targetDurationSeconds,
            targetDistanceKm
        } = req.body || {};

        const { rows } = await pool.query(
            `UPDATE routine_exercises
             SET 
                target_sets = COALESCE($1, target_sets),
                target_reps = COALESCE($2, target_reps),
                target_duration_seconds = COALESCE($3, target_duration_seconds),
                target_distance_km = COALESCE($4, target_distance_km)
             WHERE id = $5
             RETURNING *`,
            [
                targetSets,
                targetReps,
                targetDurationSeconds,
                targetDistanceKm,
                routineExerciseId
            ]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Ejercicio de rutina no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Ejercicio de rutina actualizada.",
            data: snakeToCamel(rows[0])
        });

    } catch (error) {
        next(error);
    }
};

exports.deleteRoutineExercise = async (req, res, next) => {
    try {
        const { routineExerciseId } = req.params;
        const { rowCount } = await pool.query(
            `DELETE FROM routine_exercises WHERE id = $1`,
            [routineExerciseId]
        );

        if (rowCount === 0) {
            return throwNotFoundError("Ejercicio de rutina no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Ejercicio eliminado de la rutina."
        });

    } catch (error) {
        next(error);
    }
};