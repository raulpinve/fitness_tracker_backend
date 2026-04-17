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
            targetWeight,
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
                target_weight, 
                target_duration_seconds,
                target_distance_km
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) -- 3. Añadimos un placeholder ($8)
            RETURNING *`,
            [
                uuidv7(),
                routineId,
                exerciseId,
                targetSets || null,
                targetReps || null,
                targetWeight || null, 
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
        if (error.code === '23505') {
            return res.status(400).json({
                status: "error",
                message: "Este ejercicio ya existe en la rutina."
            });
        }
        next(error);
    }
};


exports.getRoutineExercise = async (req, res, next) => {
    try {
        const { routineExerciseId } = req.params;
        const { rows } = await pool.query(
            `SELECT re.*, e.name as exercise_name, e.type as exercise_type
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
            `SELECT re.*, e.name as exercise_name, e.type as exercise_type, e.avatar, e.avatar_thumbnail
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
            targetWeight, 
            targetDurationSeconds,
            targetDistanceKm
        } = req.body || {};

        const { rows } = await pool.query(
            `UPDATE routine_exercises
             SET 
                target_sets = COALESCE($1, target_sets),
                target_reps = COALESCE($2, target_reps),
                target_weight = COALESCE($3, target_weight), 
                target_duration_seconds = COALESCE($4, target_duration_seconds),
                target_distance_km = COALESCE($5, target_distance_km)
             WHERE id = $6
             RETURNING *`,
            [
                targetSets,
                targetReps,
                targetWeight, 
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
            message: "Ejercicio de rutina actualizado.",
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

// Actualiza los pesos de una rutina basados en el progreso del workout
exports.updateRoutineProgress = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { routineId } = req.params;
        const { updates } = req.body; // Array de { exerciseId, newWeight }

        await client.query("BEGIN");

        for (const update of updates) {
            await client.query(
                `UPDATE routine_exercises 
                 SET target_weight = $1 
                 WHERE routine_id = $2 AND exercise_id = $3`,
                [update.newWeight, routineId, update.exerciseId]
            );
        }

        await client.query("COMMIT");
        res.json({ status: "success", message: "Rutina actualizada correctamente" });
    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
};
