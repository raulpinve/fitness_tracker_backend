const { uuidv7 } = require("uuidv7");
const { throwBadRequestError } = require("../errors/throwHTTPErrors");
const { pool } = require("../initDB");
const { snakeToCamel } = require("../utils/utils.helper");
const path = require('path');
const sharp = require('sharp');
const { crearCarpeta, validateSizeFile, validateMimeTypeFile, subirArchivo, eliminarArchivo } = require("../utils/files");
const fs = require('fs').promises;
sharp.cache(false);

exports.createExercise = async (req, res, next) => {
    const exerciseId = uuidv7();
    
    const imageFile = req.files["image"] && req.files["image"][0];
    const videoFile = req.files["video"] && req.files["video"][0];

    // Cambiamos muscleGroup por muscleGroups (plural)
    const { name, type, muscleGroups, equipment, description } = req.body;

    let imagePath = null;
    let thumbPath = null;
    let videoPath = null;

    try {
        // 1. Validaciones de archivos (Se mantiene igual)
        if (imageFile) {
            if (!validateSizeFile(imageFile, 2)) throwBadRequestError("image", "La imagen excede los 2MB.");
            if (!validateMimeTypeFile(["image/jpeg", "image/png", "image/webp"], imageFile)) {
                throwBadRequestError("image", "Formato de imagen no permitido.");
            }
        }

        if (videoFile) {
            if (!validateSizeFile(videoFile, 15)) throwBadRequestError("video", "El video excede los 15MB.");
            if (!validateMimeTypeFile(["video/mp4", "video/webm"], videoFile)) {
                throwBadRequestError("video", "Formato de video no permitido.");
            }
        }

        // 2. Crear carpeta del ejercicio
        const carpetaEjercicio = path.join(__dirname, `../uploads/exercises/${exerciseId}`);
        await crearCarpeta(carpetaEjercicio);

        // 3. Procesar Imagen y Miniatura
        let nombreImagen = null;
        let nombreThumb = null;

        if (imageFile) {
            nombreImagen = imageFile.newFilename;
            nombreThumb = `thumb-${path.parse(nombreImagen).name}.webp`; 
            imagePath = path.join(carpetaEjercicio, nombreImagen);
            thumbPath = path.join(carpetaEjercicio, nombreThumb);
            await subirArchivo(imageFile.filepath, imagePath);

            try {
                await sharp(imagePath).rotate().resize(300).webp({ quality: 80 }).toFile(thumbPath);
            } catch (error) {
                await eliminarArchivo(imagePath);
                throw error;
            }
        }

        // 4. Procesar Video
        let nombreVideo = null;
        if (videoFile) {
            nombreVideo = videoFile.newFilename;
            videoPath = path.join(carpetaEjercicio, nombreVideo);
            await subirArchivo(videoFile.filepath, videoPath);
        }

        // --- 5. NORMALIZACIÓN DEL ARRAY DE MÚSCULOS ---
        // Formidable v3/v4 puede entregar los datos como string o array.
        // Forzamos que muscleGroups sea siempre un Array para Postgres.
        let finalMuscleGroups = [];
        if (muscleGroups) {
            finalMuscleGroups = Array.isArray(muscleGroups) ? muscleGroups : [muscleGroups];
        }

        // 6. Insertar en Base de Datos
        try {
            const query = `
                INSERT INTO exercises (
                    id, name, type, muscle_groups, equipment, 
                    avatar, avatar_thumbnail, video, description
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;
            const values = [
                exerciseId,
                name,
                type || 'strength',
                finalMuscleGroups, // <--- Ahora pasamos el Array normalizado
                equipment || 'ninguno',
                nombreImagen,
                nombreThumb,
                nombreVideo, 
                description
            ];
            
            const { rows } = await pool.query(query, values);

            return res.status(201).json({
                statusCode: 201,
                status: "success",
                data: snakeToCamel(rows[0])
            });

        } catch (error) {
            await Promise.allSettled([
                eliminarArchivo(imagePath),
                eliminarArchivo(thumbPath),
                eliminarArchivo(videoPath)
            ]);
            throw error;
        }

    } catch (error) {
        next(error);
    }
};

exports.getExercise = async (req, res, next) => {
    try {
        const { exerciseId } = req.params;

        const query = `
            SELECT 
                id, 
                name, 
                avatar, 
                avatar_thumbnail, 
                video, 
                type, 
                muscle_groups,
                equipment, 
                description
            FROM exercises
            WHERE id = $1
        `;

        const { rows } = await pool.query(query, [exerciseId]);

        if (rows.length === 0) {
            throwNotFoundError("Ejercicio no encontrado.")
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


exports.getAllExercises = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const name = req.query.name || null;
        const type = req.query.type || null;
        const muscleGroup = req.query.muscleGroup || null;

        // 2. Cláusula WHERE dinámica actualizada para ARRAYS
        // Usamos "$3 = ANY(muscle_groups)" para buscar dentro del array
        const whereClause = `
            WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
              AND ($2::text IS NULL OR type = $2)
              AND ($3::text IS NULL OR $3 = ANY(muscle_groups))
        `;

        // Actualizamos muscle_group -> muscle_groups en el SELECT
        const query = `
            SELECT id, name, avatar, avatar_thumbnail, video, type, muscle_groups, equipment
            FROM exercises
            ${whereClause}
            ORDER BY name
            LIMIT $4 OFFSET $5
        `;

        const { rows } = await pool.query(query, [
            name,
            type,
            muscleGroup,
            pageSize,
            offset
        ]);

        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*) FROM exercises ${whereClause}`,
            [name, type, muscleGroup]
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

exports.updateExercise = async (req, res, next) => {
    try {
        const { exerciseId } = req.params;
        
        // 1. Extraemos los campos (Usamos muscleGroups en plural)
        const { name, type, muscleGroups, equipment, description } = req.body || {};
        
        // Formidable v3 entrega arrays de archivos
        const imageFile = req.files["image"] && req.files["image"][0];
        const videoFile = req.files["video"] && req.files["video"][0];

        // 2. Obtener datos actuales de la DB
        const { rows: currentRows } = await pool.query(
            "SELECT avatar, avatar_thumbnail, video FROM exercises WHERE id = $1",
            [exerciseId]
        );

        if (currentRows.length === 0) return next(throwNotFoundError("Ejercicio no encontrado."));
        
        const { avatar: oldAvatar, avatar_thumbnail: oldThumb, video: oldVideo } = currentRows[0];
        const carpetaEjercicio = path.join(__dirname, `../uploads/exercises/${exerciseId}`);
        await fs.mkdir(carpetaEjercicio, { recursive: true });

        let nombreImagen = oldAvatar;
        let nombreThumb = oldThumb;
        let nombreVideo = oldVideo;

        // 3. Procesar Imagen Nueva
        if (imageFile) {
            if (oldAvatar) await fs.unlink(path.join(carpetaEjercicio, oldAvatar)).catch(() => {});
            if (oldThumb) await fs.unlink(path.join(carpetaEjercicio, oldThumb)).catch(() => {});

            nombreImagen = `${Date.now()}-${imageFile.newFilename}`;
            nombreThumb = `thumb-${path.parse(nombreImagen).name}.webp`;
            
            const imagePath = path.join(carpetaEjercicio, nombreImagen);
            const thumbPath = path.join(carpetaEjercicio, nombreThumb);

            await fs.copyFile(imageFile.filepath, imagePath);
            await fs.unlink(imageFile.filepath);

            await sharp(imagePath)
                .rotate()
                .resize(300)
                .webp({ quality: 80 })
                .toFile(thumbPath);
        }

        // 4. Procesar Video Nuevo
        if (videoFile) {
            if (oldVideo) await fs.unlink(path.join(carpetaEjercicio, oldVideo)).catch(() => {});

            nombreVideo = `${Date.now()}-${videoFile.newFilename}`;
            const videoPath = path.join(carpetaEjercicio, nombreVideo);

            await fs.copyFile(videoFile.filepath, videoPath);
            await fs.unlink(videoFile.filepath);
        }

        // --- 5. NORMALIZACIÓN DEL ARRAY DE MÚSCULOS ---
        // Si no viene nada en el body, mantenemos lo que hay en la DB usando COALESCE en el SQL.
        // Pero si viene algo, nos aseguramos de que sea un Array para Postgres.
        let finalMuscleGroups = null; 
        if (muscleGroups) {
            finalMuscleGroups = Array.isArray(muscleGroups) ? muscleGroups : [muscleGroups];
        }

        // 6. DB Update (Actualizamos a muscle_groups)
        const { rows } = await pool.query(
            `UPDATE exercises SET 
                name = COALESCE($1, name), 
                type = COALESCE($2, type),
                muscle_groups = COALESCE($3, muscle_groups), -- <--- plural
                equipment = COALESCE($4, equipment),
                description = COALESCE($5, description),
                avatar = $6, 
                avatar_thumbnail = $7, 
                video = $8
             WHERE id = $9 RETURNING *`,
            [
                name, 
                type, 
                finalMuscleGroups, // Enviamos el array o null para el COALESCE
                equipment, 
                description, 
                nombreImagen, 
                nombreThumb, 
                nombreVideo, 
                exerciseId
            ]
        );

        return res.status(200).json({
            status: "success",
            data: snakeToCamel(rows[0])
        });

    } catch (error) {
        next(error);
    }
};

exports.deleteExercise = async (req, res, next) => {
    try {
        const { exerciseId } = req.params;
        const { rowCount } = await pool.query(
            `DELETE FROM exercises WHERE id = $1`,
            [exerciseId]
        );
        if (rowCount === 0) {
            return throwNotFoundError("Ejercicio no encontrado.");
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Ejercicio eliminado exitosamente."
        });

    } catch (error) {
        console.log(error)
        next(error);
    }
};

exports.getExerciseProgress = async (req, res, next) => {
    try {
        const { exerciseId } = req.params;
        const userId = req.user.id;

        const query = `
            SELECT 
                TO_CHAR(w.started_at, 'DD/MM') as "date",
                -- NORMALIZACIÓN: Si es LB, lo pasamos a KG para la gráfica
                MAX(
                    CASE 
                        WHEN ws.weight_unit = 'lb' THEN ws.weight * 0.453592 
                        ELSE ws.weight 
                    END
                ) as "value" 
            FROM workout_sets ws
            JOIN workout_exercises we ON ws.workout_exercise_id = we.id
            JOIN workouts w ON we.workout_id = w.id
            WHERE we.exercise_id = $1 
              AND w.user_id = $2 
              AND w.finished_at IS NOT NULL
            GROUP BY w.started_at
            ORDER BY w.started_at ASC
            LIMIT 15;
        `;

        const { rows } = await pool.query(query, [exerciseId, userId]);
        res.status(200).json({ status: "success", data: rows });
    } catch (error) {
        next(error);
    }
};
