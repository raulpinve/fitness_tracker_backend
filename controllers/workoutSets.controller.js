const { uuidv7 } = require("uuidv7");
const { throwNotFoundError, throwConflictError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createWorkoutSet = async (req, res, next) => {

    const client = await pool.connect();
    try {
        const { workoutId, exerciseId, reps, weight, rpe } = req.body;

        await client.query("BEGIN");

        // 1. Get or create the workout_exercise (anchor)
        // We use ON CONFLICT to ensure the relationship is not duplicated
        const { rows: weRows } = await client.query(
            `INSERT INTO workout_exercises (id, workout_id, exercise_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (workout_id, exercise_id) 
             DO UPDATE SET workout_id = EXCLUDED.workout_id 
             RETURNING id`,
            [uuidv7(), workoutId, exerciseId]
        );

        const workoutExerciseId = weRows[0].id;

        // 2. Calculate the next set number
        // We count how many there are and add 1
        const { rows: countRows } = await client.query(
            `SELECT COALESCE(MAX(set_number), 0) + 1 as next_set
             FROM workout_sets
             WHERE workout_exercise_id = $1`,
            [workoutExerciseId]
        );

        const nextSetNumber = countRows[0].next_set;

        // 3. Insert the set with its sequential number
        const { rows: setRows } = await client.query(
            `INSERT INTO workout_sets (id, workout_exercise_id, set_number, reps, weight, rpe)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [uuidv7(), workoutExerciseId, nextSetNumber, reps, weight, rpe]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            data: snakeToCamel(setRows[0])
        });

    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
};

exports.getWorkoutSet = async (req, res, next) => {
    try {
        const { workoutSetId } = req.params;

        const { rows } = await pool.query(
            `SELECT *
             FROM workout_sets
             WHERE id = $1`,
            [workoutSetId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Set no encontrado.");
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

exports.getAllWorkoutSets = async (req, res, next) => {
    try {
        const { workoutId, exerciseId } = req.query;
        const { rows } = await pool.query(
            `SELECT ws.* 
                FROM workout_sets ws
                JOIN workout_exercises we ON ws.workout_exercise_id = we.id
                WHERE we.workout_id = $1 AND we.exercise_id = $2
                ORDER BY ws.created_at ASC;
            `, [
            workoutId, exerciseId
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

exports.updateWorkoutSet = async (req, res, next) => {
    try {
        const { workoutSetId } = req.params;

        const { reps, weight } = req.body || {};

        const { rows } = await pool.query(
            `UPDATE workout_sets
             SET 
                reps = COALESCE($1, reps),
                weight = COALESCE($2, weight)
             WHERE id = $3
             RETURNING *`,
            [
                reps,
                weight,
                workoutSetId
            ]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Set no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Set actualizado.",
            data: snakeToCamel(rows[0])
        });

    } catch (error) {
        next(error);
    }
};

exports.deleteWorkoutSet = async (req, res, next) => {

    const client = await pool.connect();
    
    try {
        const { workoutSetId } = req.params;
        await client.query("BEGIN");

        // 1. Get the parent anchor ID before deleting the set
        const { rows: setRows } = await client.query(
            "SELECT workout_exercise_id FROM workout_sets WHERE id = $1",
            [workoutSetId]
        );

        if (setRows.length === 0) return throwNotFoundError("Set not found.");
        const weId = setRows[0].workout_exercise_id;

        // 2. Delete the specific workout set
        await client.query("DELETE FROM workout_sets WHERE id = $1", [workoutSetId]);

        // 3. Check if the exercise anchor still has any remaining activity (sets or cardio logs)
        const { rows: remainingSets } = await client.query(
            "SELECT id FROM workout_sets WHERE workout_exercise_id = $1 LIMIT 1", 
            [weId]
        );
        const { rows: remainingLogs } = await client.query(
            "SELECT id FROM cardio_logs WHERE workout_exercise_id = $1 LIMIT 1", 
            [weId]
        );

        // 4. If the exercise has no more records, remove the workout_exercise entry
        if (remainingSets.length === 0 && remainingLogs.length === 0) {
            await client.query("DELETE FROM workout_exercises WHERE id = $1", [weId]);
        }

        await client.query("COMMIT");

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Set deleted successfully."
        });

    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
};
