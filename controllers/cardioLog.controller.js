const { uuidv7 } = require("uuidv7");
const { throwNotFoundError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createCardioLog = async (req, res, next) => {
    try {
        const {
            workoutExerciseId,
            durationSeconds,
            distanceKm,
            calories,
            avgHeartRate
        } = req.body;

        const { rows } = await pool.query(
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

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            data: snakeToCamel(rows[0])
        });
    } catch (error) {
        next(error);
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

exports.getCardioLogs = async (req, res, next) => {
    try {
        const { workoutExerciseId } = req.query;
        if (!workoutExerciseId) {
            return res.status(400).json({ message: "workoutExerciseId es requerido" });
        }

        const { rows } = await pool.query(
            `SELECT * FROM cardio_logs
                WHERE workout_exercise_id = $1
                ORDER BY created_at ASC`, [
                workoutExerciseId
        ]);

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            data: rows.map(snakeToCamel)
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
    try {
        const { cardioLogId } = req.params;

        const { rowCount } = await pool.query(
            `DELETE FROM cardio_logs WHERE id = $1`,
            [cardioLogId]
        );

        if (rowCount === 0) {
            return throwNotFoundError("Registro de cardio no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Registro de cardio eliminado."
        });
    } catch (error) {
        next(error);
    }
};
