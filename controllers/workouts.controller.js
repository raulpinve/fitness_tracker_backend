const { uuidv7 } = require("uuidv7");
const { throwBadRequestError, throwNotFoundError, throwConflictError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createWorkout = async (req, res, next) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const { routineId, name } = req.body || {};
        const { id: userId } = req.user;

        const defaultName = name || `${new Date().toLocaleDateString('es-ES', { 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        })}`;

        // 1. Create the main workout
        const { rows: rowsWorkout } = await client.query(
            `INSERT INTO workouts (id, name, user_id, routine_id, started_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING *`,
            [uuidv7(), defaultName, userId, routineId || null]
        );
        const workoutId = rowsWorkout[0].id;

        // 2. If there is a routine, fetch its exercises and insert them one by one with new IDs
        if (routineId) {
            // Buscamos los ejercicios asociados a esa rutina
            const { rows: routineExercises } = await client.query(
                `SELECT exercise_id FROM routine_exercises WHERE routine_id = $1`,
                [routineId]
            );
            if (routineExercises.length > 0) {
                // We prepare the parameters for a single bulk INSERT
                // We want something like: INSERT INTO ... VALUES ($1, $2, $3), ($4, $5, $6)...
                const values = [];
                const placeholders = routineExercises.map((re, index) => {
                    const offset = index * 3;
                    values.push(uuidv7(), workoutId, re.exercise_id); 
                    return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
                }).join(', ');

                const insertExercisesQuery = `
                    INSERT INTO workout_exercises (id, workout_id, exercise_id)
                    VALUES ${placeholders}
                `;
                await client.query(insertExercisesQuery, values);
            }
        }
        await client.query("COMMIT");

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            data: snakeToCamel(rowsWorkout[0])
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error en createWorkout:", error);
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
exports.summary = async (req, res, next) => {
    try {
        const { workoutId } = req.params;

        // 1. Ejecutamos la query potente que compara meta vs realidad
        const { rows, rowCount } = await pool.query(
            `SELECT 
                re.routine_id as "routineId",
                e.id as "exerciseId",
                e.name,
                e.type,
                COALESCE(re.target_weight, 0) as "oldWeight",
                (COALESCE(re.target_weight, 0) + 2.5) as "suggestedWeight",
                re.target_reps,
                re.target_sets,
                CASE 
                    WHEN MIN(ws.reps) >= re.target_reps AND COUNT(ws.id) >= re.target_sets THEN true 
                    ELSE false 
                END as "canProgress"
            FROM workout_exercises we
            JOIN exercises e ON we.exercise_id = e.id
            JOIN workouts w ON we.workout_id = w.id
            JOIN routine_exercises re ON (w.routine_id = re.routine_id AND we.exercise_id = re.exercise_id)
            JOIN workout_sets ws ON we.id = ws.workout_exercise_id
            WHERE we.workout_id = $1
            GROUP BY 
                re.routine_id, 
                e.id, 
                e.name, 
                e.type, 
                re.target_weight, 
                re.target_reps, 
                re.target_sets;`,
            [workoutId]
        );


        // 2. Si no hay filas, puede que el workout no exista o no tenga ejercicios de rutina
        if (rowCount === 0) {
            return res.status(404).json({
                statusCode: 404,
                status: "error",
                message: "No se encontraron ejercicios de rutina para este entrenamiento."
            });
        }

        // 3. Devolvemos la data analizada para que el Frontend la muestre
        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Análisis de progreso generado.",
            data: rows.map(snakeToCamel) // Aquí viaja la lista con los flags 'canProgress'
        });

    } catch (error) {
        next(error);
    }
};

exports.updateRoutineProgress = async (req, res, next) => {
    const { routineId } = req.body; 
    const { updates } = req.body; 

    if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ message: "No se proporcionaron actualizaciones válidas." });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const update of updates) {
            await client.query(
                `UPDATE routine_exercises 
                 SET target_weight = $1 
                 WHERE routine_id = $2 AND exercise_id = $3`,
                [update.newWeight, routineId, update.exerciseId]
            );
        }

        await client.query('COMMIT');

        res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Rutina actualizada con los nuevos pesos de forma masiva."
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};
