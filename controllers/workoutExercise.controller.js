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
        const pageSize = parseInt(req.query.pageSize) || 20; // Recomiendo 20 para mobile
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
                e.type as exercise_type,
                -- Metas generales (Fuerza)
                re.target_sets,
                re.target_reps,
                re.target_weight,
                -- Metas específicas (Cardio)
                re.target_duration_seconds,
                re.target_distance_km
             FROM workout_exercises AS we
             INNER JOIN exercises AS e ON we.exercise_id = e.id
             LEFT JOIN workouts AS w ON we.workout_id = w.id
             LEFT JOIN routine_exercises AS re 
                ON w.routine_id = re.routine_id 
                AND we.exercise_id = re.exercise_id
             WHERE we.workout_id = $1
             ORDER BY we.created_at ASC
             LIMIT $2 OFFSET $3`,
            [workoutId, pageSize, offset]
        );

        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*) FROM workout_exercises WHERE workout_id = $1`,
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
exports.getWorkoutActiveExercises = async (req, res, next) => {
    try {
        const { workoutId } = req.query;

        const query = `
            -- PART 1: Planned exercises from the routine
            SELECT 
                e.id as "exerciseId",
                e.name as "exerciseName",
                e.type as "exerciseType",
                e.avatar_thumbnail as "exerciseAvatarThumbnail",
                we.id as "workoutExerciseId", 
                re.target_sets as "targetSets",
                re.target_reps as "targetReps",
                re.target_weight as "targetWeight",
                -- SUGGESTED WEIGHT: Priority 1: Routine target, Priority 2: Last weight ever lifted
                COALESCE(re.target_weight, (
                    SELECT ws_last.weight FROM workout_sets ws_last
                    JOIN workout_exercises we_last ON ws_last.workout_exercise_id = we_last.id
                    JOIN workouts w_last ON we_last.workout_id = w_last.id
                    WHERE we_last.exercise_id = e.id AND w_last.user_id = w.user_id
                    ORDER BY ws_last.created_at DESC LIMIT 1
                ), 0) as "suggestedWeight",
                re.target_duration_seconds as "targetDurationSeconds",
                re.target_distance_km as "targetDistanceKm",
                COALESCE(we.order_index, 0) as "orderIndex",
                w.started_at as "createdAt",
                (
                    SELECT MAX(ws_inner.weight)
                    FROM workout_sets ws_inner
                    JOIN workout_exercises we_inner ON ws_inner.workout_exercise_id = we_inner.id
                    JOIN workouts w_inner ON we_inner.workout_id = w_inner.id
                    WHERE we_inner.exercise_id = e.id 
                    AND w_inner.user_id = w.user_id
                    AND w_inner.finished_at IS NOT NULL
                ) as "personalRecord"
            FROM workouts w
            JOIN routine_exercises re ON w.routine_id = re.routine_id
            JOIN exercises e ON re.exercise_id = e.id
            LEFT JOIN workout_exercises we ON (we.workout_id = w.id AND we.exercise_id = e.id)
            WHERE w.id = $1

            UNION

            -- PART 2: Extra exercises (or Free Session)
            SELECT 
                e.id as "exerciseId",
                e.name as "exerciseName",
                e.type as "exerciseType",
                e.avatar_thumbnail as "exerciseAvatarThumbnail",
                we.id as "workoutExerciseId",
                NULL as "targetSets",
                NULL as "targetReps",
                NULL as "targetWeight",
                -- For extras, we ONLY look for the last weight lifted in history
                COALESCE((
                    SELECT ws_last.weight FROM workout_sets ws_last
                    JOIN workout_exercises we_last ON ws_last.workout_exercise_id = we_last.id
                    JOIN workouts w_last ON we_last.workout_id = w_last.id
                    WHERE we_last.exercise_id = e.id AND w_last.user_id = w.user_id
                    ORDER BY ws_last.created_at DESC LIMIT 1
                ), 0) as "suggestedWeight",
                NULL as "targetDurationSeconds",
                NULL as "targetDistanceKm",
                COALESCE(we.order_index, 999) as "orderIndex",
                we.created_at as "createdAt",
                (
                    SELECT MAX(ws_inner.weight)
                    FROM workout_sets ws_inner
                    JOIN workout_exercises we_inner ON ws_inner.workout_exercise_id = we_inner.id
                    JOIN workouts w_inner ON we_inner.workout_id = w_inner.id
                    WHERE we_inner.exercise_id = e.id 
                    AND w_inner.user_id = w.user_id
                    AND w_inner.finished_at IS NOT NULL
                ) as "personalRecord"
            FROM workout_exercises we
            JOIN exercises e ON we.exercise_id = e.id
            JOIN workouts w ON we.workout_id = w.id
            LEFT JOIN routine_exercises re ON (w.routine_id = re.routine_id AND we.exercise_id = re.exercise_id)
            WHERE we.workout_id = $1 AND re.exercise_id IS NULL
            
            ORDER BY "orderIndex" ASC, "createdAt" ASC;
        `;

        const { rows } = await pool.query(query, [workoutId]);

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            data: rows
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