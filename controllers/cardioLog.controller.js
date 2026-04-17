const { uuidv7 } = require("uuidv7");
const { throwNotFoundError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createCardioLog = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const {
            workoutId, // Cambiamos workoutExerciseId por estos dos
            exerciseId,
            durationSeconds,
            distanceKm,
            calories,
            avgHeartRate
        } = req.body;

        await client.query("BEGIN");

        // 1. Obtener o crear el workout_exercise (ancla)
        const { rows: weRows } = await client.query(
            `INSERT INTO workout_exercises (id, workout_id, exercise_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (workout_id, exercise_id) 
             DO UPDATE SET workout_id = EXCLUDED.workout_id 
             RETURNING id`,
            [uuidv7(), workoutId, exerciseId]
        );

        const workoutExerciseId = weRows[0].id;

        // 2. Insertar el log de cardio vinculado
        const { rows } = await client.query(
            `INSERT INTO cardio_logs (
                id,
                workout_exercise_id,
                duration_seconds,
                distance_km,
                calories,
                avg_heart_rate
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`, [
                uuidv7(),
                workoutExerciseId,
                durationSeconds,
                distanceKm,
                calories,
                avgHeartRate
        ]);

        await client.query("COMMIT");

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            data: snakeToCamel(rows[0])
        });
    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
};


exports.getCardioLog = async (req, res, next) => {
    try {
        const { cardioLogId } = req.params;

        const { rows } = await pool.query(
            `SELECT * FROM cardio_logs WHERE id = $1`,
            [cardioLogId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Registro de cardio no encontrado.");
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

exports.getAllCardioLogs = async (req, res, next) => {
    try {
        const { workoutId, exerciseId } = req.query;

        // Verify that both identifiers are present
        if (!workoutId || !exerciseId) {
            return res.status(400).json({ 
                statusCode: 400,
                status: "error",
                message: "workoutId and exerciseId are required" 
            });
        }

        // Fetch logs by joining with the workout_exercises anchor table
        const { rows } = await pool.query(
            `SELECT cl.* 
             FROM cardio_logs cl
             JOIN workout_exercises we ON cl.workout_exercise_id = we.id
             WHERE we.workout_id = $1 AND we.exercise_id = $2
             ORDER BY cl.created_at ASC`, 
            [workoutId, exerciseId]
        );

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            data: rows.map(snakeToCamel) // Normalizing to camelCase for the frontend
        });

    } catch (error) {
        next(error);
    }
};


exports.updateCardioLog = async (req, res, next) => {
    try {
        const { cardioLogId } = req.params;
        const { durationSeconds, distanceKm, calories, avgHeartRate } = req.body || {};

        const { rows } = await pool.query(
            `UPDATE cardio_logs
             SET 
                duration_seconds = COALESCE($1, duration_seconds),
                distance_km = COALESCE($2, distance_km),
                calories = COALESCE($3, calories),
                avg_heart_rate = COALESCE($4, avg_heart_rate)
             WHERE id = $5
             RETURNING *`,
            [durationSeconds, distanceKm, calories, avgHeartRate, cardioLogId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Registro de cardio no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Cardio actualizado.",
            data: snakeToCamel(rows[0])
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteCardioLog = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { cardioLogId } = req.params;

        await client.query("BEGIN");

        // 1. Get the workout_exercise_id before deleting the log
        const { rows: logRows } = await client.query(
            "SELECT workout_exercise_id FROM cardio_logs WHERE id = $1",
            [cardioLogId]
        );
        if (logRows.length === 0) {
            throwNotFoundError("Ejercicio no encontrado.");
        }

        const weId = logRows[0].workout_exercise_id;

        // 2. Delete the specific cardio log
        await client.query("DELETE FROM cardio_logs WHERE id = $1", [cardioLogId]);

        // 3. Check if there are any records left for this anchor
        const { rows: remainingSets } = await client.query(
            "SELECT id FROM workout_sets WHERE workout_exercise_id = $1 LIMIT 1",
            [weId]
        );
        
        const { rows: remainingLogs } = await client.query(
            "SELECT id FROM cardio_logs WHERE workout_exercise_id = $1 LIMIT 1",
            [weId]
        );

        // 4. Clean up the anchor if empty
        if (remainingSets.length === 0 && remainingLogs.length === 0) {
            await client.query("DELETE FROM workout_exercises WHERE id = $1", [weId]);
        }

        await client.query("COMMIT");

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Ejercicio eliminado exitosamente."
        });

    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
};
