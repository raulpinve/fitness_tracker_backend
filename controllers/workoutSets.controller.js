const { uuidv7 } = require("uuidv7");
const { throwNotFoundError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createWorkoutSet = async (req, res, next) => {
    try {
        const {
            workoutExerciseId,
            reps,
            weight
        } = req.body;

        const { rows: rowsWorkouts } = await pool.query(
            `SELECT COALESCE(MAX(set_number), 0) + 1 AS next
                FROM workout_sets
                WHERE workout_exercise_id = $1 `,
            [workoutExerciseId]
        );
        const setNumber = rowsWorkouts[0].next;

        const { rows } = await pool.query(
            `INSERT INTO workout_sets (
                id,
                workout_exercise_id,
                set_number,
                reps,
                weight
            )
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *`, [
                uuidv7(),
                workoutExerciseId,
                setNumber,
                reps,
                weight
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

exports.getWorkoutSets = async (req, res, next) => {
    try {
        const { workoutExerciseId } = req.query;
        if (!workoutExerciseId) {
            return res.status(400).json({ message: "workoutExerciseId es requerido" });
        }

        const { rows } = await pool.query(
            `SELECT * FROM workout_sets
                WHERE workout_exercise_id = $1
                ORDER BY set_number ASC`, [
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
    try {
        const { workoutSetId } = req.params;

        // 1. Obtener el set antes de borrarlo
        const { rows } = await pool.query(
            `SELECT set_number
             FROM workout_sets
             WHERE id = $1`,
            [workoutSetId]
        );

        if (rows.length === 0) {
            return throwNotFoundError("Set no encontrado.");
        }

        const { set_number } = rows[0];

        // 2. Eliminar el set
        await pool.query(
            `DELETE FROM workout_sets WHERE id = $1`,
            [workoutSetId]
        );

        // 3. Reordenar los sets posteriores
        await pool.query(
            `UPDATE workout_sets
             SET set_number = set_number - 1
             WHERE set_number > $1`,
            [set_number]
        );

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Set eliminado."
        });

    } catch (error) {
        next(error);
    }
};