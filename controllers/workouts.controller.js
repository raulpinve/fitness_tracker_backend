const { uuidv7 } = require("uuidv7");
const { throwBadRequestError, throwNotFoundError, throwConflictError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.createWorkout = async (req, res, next) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        
        // 1. Extraemos startedAt del body (ya saneado por express-validator)
        const { routineId, name, startedAt } = req.body || {};
        const { id: userId } = req.user;

        const defaultName = name || `${new Date().toLocaleDateString('es-ES', { 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        })}`;

        // 2. Cambiamos NOW() por el parámetro $5
        const { rows: rowsWorkout } = await client.query(
            `INSERT INTO workouts (id, name, user_id, routine_id, started_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                uuidv7(), 
                defaultName, 
                userId, 
                routineId || null, 
                startedAt // El objeto Date que generó .toDate() en el validador
            ]
        );

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
            SELECT w.*, r.name as routine_name
            FROM workouts as w
            INNER JOIN routines as r
            ON w.routine_id = r.id
            WHERE w.user_id = $1
            ORDER BY w.started_at DESC
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
    const { workoutId } = req.params;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const resFinish = await client.query(
            `UPDATE workouts 
                SET finished_at = (
                    SELECT MAX(ultimo_momento)
                    FROM (
                        -- Momento del último set (Fuerza)
                        SELECT MAX(ws.created_at) as ultimo_momento
                        FROM workout_sets ws
                        JOIN workout_exercises we ON ws.workout_exercise_id = we.id
                        WHERE we.workout_id = $1
                        
                        UNION ALL
                        
                        -- Momento en que se agregó el último ejercicio (Cardio/Extras)
                        SELECT MAX(created_at) as ultimo_momento
                        FROM workout_exercises
                        WHERE workout_id = $1
                    ) AS subconsulta
                )
                WHERE id = $1`,
            [workoutId]
        );

        if (resFinish.rowCount === 0) {
            throw new Error("Workout no encontrado");
        }

        await client.query("COMMIT");

        res.status(200).json({
            status: "success",
            message: "Entrenamiento finalizado y limpiado.",
            data: resFinish.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
};

exports.deleteWorkout = async (req, res, next) => {
    try {
        const { workoutId } = req.params;
        const userId = req.user.id;

        // Borramos el workout (esto borrará sus ejercicios y sets por el CASCADE)
        const result = await pool.query(
            'DELETE FROM workouts WHERE id = $1 AND user_id = $2',
            [workoutId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ status: "error", message: "Entrenamiento no encontrado" });
        }

        res.status(200).json({ status: "success", message: "Entrenamiento eliminado" });
    } catch (error) {
        next(error);
    }
};


exports.getWorkoutSummary = async (req, res, next) => {
    try {
        const { workoutId } = req.params;
        const query = `
            WITH stats AS (
                SELECT 
                    e.id as "exerciseId",
                    e.name as "name",
                    e.type as "type",
                    w.finished_at as "finishedAt",
                    we.id as "workoutExerciseId",
                    COALESCE(re.target_weight, 0) as "oldWeight",
                    COALESCE(re.target_reps, 0) as "targetReps",
                    COALESCE(re.target_sets, 0) as "targetSets",
                    MAX(ws.weight) as "maxWeight",
                    -- Capturamos la unidad del set con el peso máximo
                    (
                        SELECT weight_unit 
                        FROM workout_sets 
                        WHERE workout_exercise_id = we.id 
                        ORDER BY weight DESC, created_at DESC 
                        LIMIT 1
                    ) as "weightUnit",
                    MAX(ws.reps) as "repsDone",
                    COUNT(ws.id) as "setsDone",
                    w.routine_id as "routineId"
                FROM workout_exercises we
                JOIN exercises e ON we.exercise_id = e.id
                JOIN workouts w ON we.workout_id = w.id
                LEFT JOIN routine_exercises re ON (w.routine_id = re.routine_id AND we.exercise_id = re.exercise_id)
                LEFT JOIN workout_sets ws ON ws.workout_exercise_id = we.id
                WHERE we.workout_id = $1
                GROUP BY e.id, e.name, w.finished_at, e.type, we.id, re.target_weight, re.target_reps, re.target_sets, w.routine_id
            )
            SELECT * FROM stats;
        `;


        const { rows } = await pool.query(query, [workoutId]);

        const summary = rows.map(row => {
            const hasTarget = Number(row.targetSets) > 0;
            
            // Lógica ESTRICTA de cumplimiento
            const metWeightGoal = Number(row.maxWeight) >= Number(row.oldWeight);
            
            const canProgress = hasTarget && 
                Number(row.setsDone) >= Number(row.targetSets) && 
                Number(row.repsDone) >= Number(row.targetReps) &&
                metWeightGoal;

            // --- LÓGICA DE INCREMENTO DINÁMICO ---
            // Si la unidad es 'lb', subimos 5. Si es 'kg' (o cualquier otra cosa), subimos 2.5.
            const increment = (row.weightUnit === 'lb') ? 5 : 2.5;

            return {
                ...row,
                canProgress,
                // Aplicamos el incremento basado en la unidad detectada
                suggestedWeight: canProgress 
                    ? Math.max(Number(row.oldWeight), Number(row.maxWeight)) + increment 
                    : Number(row.oldWeight) 
            };
        });


        res.status(200).json({ status: "success", data: summary });
    } catch (error) {
        next(error);
    }
};

exports.updateRoutineProgress = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { routineId } = req.params;
        const { updates } = req.body; 

        await client.query("BEGIN");

        for (const update of updates) {
            // USAMOS ESTA QUERY QUE ES MÁS AGRESIVA
            const result = await client.query(
                `UPDATE routine_exercises 
                 SET target_weight = $1 
                 WHERE routine_id = $2 AND exercise_id = $3
                 RETURNING *`, // <--- Esto nos dirá si encontró la fila
                [update.newWeight, routineId, update.exerciseId]
            );
            
            console.log(`Ejercicio ${update.exerciseId}: ${result.rowCount} filas actualizadas`);
        }

        await client.query("COMMIT");
        res.json({ status: "success" });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("ERROR CRÍTICO EN DB:", error);
        next(error);
    } finally {
        client.release();
    }
};

exports.getWorkoutHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Obtenemos página y límite de la query string (por defecto 1 y 10)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const query = `
            SELECT 
                w.id,
                w.name,
                w.started_at as "startedAt",
                w.finished_at as "finishedAt",
                COALESCE(SUM(ws.weight * ws.reps), 0) as "totalVolume",
                COUNT(DISTINCT we.exercise_id) as "exerciseCount",
                (
                    SELECT string_agg(e.name, ', ')
                    FROM (
                        SELECT e2.name
                        FROM workout_exercises we2
                        JOIN exercises e2 ON we2.exercise_id = e2.id
                        WHERE we2.workout_id = w.id
                        ORDER BY we2.created_at ASC
                        LIMIT 3
                    ) e
                ) as "exercisesPreview"
            FROM workouts w
            LEFT JOIN workout_exercises we ON w.id = we.workout_id
            LEFT JOIN workout_sets ws ON we.id = ws.workout_exercise_id
            WHERE w.user_id = $1 AND w.finished_at IS NOT NULL
            GROUP BY w.id
            ORDER BY w.started_at DESC
            LIMIT $2 OFFSET $3;
        `;

        const { rows } = await pool.query(query, [userId, limit, offset]);

        // Consulta para saber el total de registros y manejar el "hasMore" en el front
        const countQuery = `SELECT COUNT(*) FROM workouts WHERE user_id = $1 AND finished_at IS NOT NULL`;
        const countResult = await pool.query(countQuery, [userId]);
        const totalRecords = parseInt(countResult.rows[0].count);

        res.status(200).json({
            status: "success",
            data: rows,
            pagination: {
                totalRecords,
                currentPage: page,
                totalPages: Math.ceil(totalRecords / limit),
                hasNextPage: offset + rows.length < totalRecords
            }
        });
    } catch (error) {
        next(error);
    }
};

