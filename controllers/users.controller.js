const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");

exports.getUserStats = async (req, res, next) => {
    try {
        const userId = req.user.id; 

        // QUERY 1: Total completed workouts
        const totalWorkoutsQuery = `
            SELECT COUNT(*) as total 
            FROM workouts 
            WHERE user_id = $1 AND finished_at IS NOT NULL
        `;

        // QUERY 2: Streak of days (Consecutive days training up to today)
        // This query looks for how many consecutive days backwards there are records
        const streakQuery = `
            WITH RECURSIVE dates AS (
                SELECT CAST(finished_at AS DATE) as workout_date
                FROM workouts
                WHERE user_id = $1 AND finished_at IS NOT NULL
                GROUP BY workout_date
            ),
            streak_calc AS (
                -- Empezamos desde el último entrenamiento (si fue hoy o ayer)
                SELECT workout_date, 1 as day_count
                FROM dates
                WHERE workout_date >= CURRENT_DATE - INTERVAL '1 day'
                
                UNION ALL
                
                -- Vamos uniendo los días anteriores consecutivos
                SELECT d.workout_date, s.day_count + 1
                FROM dates d
                INNER JOIN streak_calc s ON d.workout_date = s.workout_date - INTERVAL '1 day'
            )
            SELECT COALESCE(MAX(day_count), 0) as current_streak FROM streak_calc;
        `;

        const [totalRes, streakRes] = await Promise.all([
            pool.query(totalWorkoutsQuery, [userId]),
            pool.query(streakQuery, [userId])
        ]);

        return res.json({
            statusCode: 200,
            status: "success",
            data: {
                totalWorkouts: parseInt(totalRes.rows[0].total),
                currentStreak: parseInt(streakRes.rows[0].current_streak)
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, username, email } = req.body;

        // 1. Validate if the new username or email already exist (in other users)
        const { rows: existing } = await pool.query(
            `SELECT id, username, email FROM users 
             WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)) 
             AND id != $3`,
            [username, email, userId]
        );

        if (existing.length > 0) {
            const conflict = existing[0].email.toLowerCase() === email.toLowerCase() ? "email" : "username";
            return res.status(409).json({ 
                statusCode: 409, 
                message: `El ${conflict} ya está registrado por otro atleta.` 
            });
        }

        // 2. Update (Using RETURNING to fetch the new data in one go)
        const { rows } = await pool.query(
            `UPDATE users 
             SET first_name = $1, last_name = $2, username = $3, email = $4
             WHERE id = $5
             RETURNING id, first_name, last_name, username, email, avatar_thumbnail`,
            [firstName.trim(), lastName.trim(), username.trim(), email.toLowerCase().trim(), userId]
        );

        // 3. Normalize to camelCase and respond
        const updatedUser = snakeToCamel(rows[0]);

        return res.json({
            statusCode: 200,
            status: "success",
            message: "Perfil actualizado",
            data: updatedUser
        });

    } catch (error) {
        next(error);
    }
};
