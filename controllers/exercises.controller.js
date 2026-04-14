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
    
    // Formidable v3 entrega arrays: [file]
    const imageFile = req.files["image"] && req.files["image"][0];
    const videoFile = req.files["video"] && req.files["video"][0];

    const { name, type, muscleGroup, equipment } = req.body;

    let imagePath = null;
    let thumbPath = null;
    let videoPath = null;

    try {
        // 1. Validaciones de archivos (Siguiendo tu lógica)
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
            // Forzamos la extensión .webp en el thumbnail para asegurar transparencia y poco peso
            nombreThumb = `thumb-${path.parse(nombreImagen).name}.webp`; 
            
            imagePath = path.join(carpetaEjercicio, nombreImagen);
            thumbPath = path.join(carpetaEjercicio, nombreThumb);

            await subirArchivo(imageFile.filepath, imagePath);

            try {
                await sharp(imagePath)
                    .rotate()
                    .resize(300)
                    .webp({ quality: 80 }) 
                    .toFile(thumbPath);
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

        // 5. Insertar en Base de Datos
        try {
            const query = `
                INSERT INTO exercises (
                    id, name, type, muscle_group, equipment, 
                    avatar, avatar_thumbnail, video
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
            const values = [
                exerciseId,
                name,
                type || 'strength',
                muscleGroup,
                equipment || 'ninguno',
                nombreImagen,
                nombreThumb,
                nombreVideo
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

        const { rows } = await pool.query(
            `SELECT id, name, avatar, avatar_thumbnail, video, type, muscle_group, equipment
             FROM exercises
             WHERE id = $1`,
            [exerciseId]
        );
        if (rows.length === 0) {
            return throwNotFoundError("Ejercicio no encontrado.");
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
        // 1. Extraemos todos los parámetros de la query
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const name = req.query.name || null;
        const type = req.query.type || null;
        const muscleGroup = req.query.muscleGroup || null;

        // 2. Construimos la cláusula WHERE dinámica
        // El truco ($N::text IS NULL OR columna = $N) permite que si el parámetro es null, se ignore el filtro
        const whereClause = `
            WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
              AND ($2::text IS NULL OR type = $2)
              AND ($3::text IS NULL OR muscle_group = $3)
        `;

        const query = `
            SELECT id, name, avatar, avatar_thumbnail, video, type, muscle_group, equipment
            FROM exercises
            ${whereClause}
            ORDER BY name
            LIMIT $4 OFFSET $5
        `;

        // 3. Ejecutamos la consulta principal
        const { rows } = await pool.query(query, [
            name,
            type,
            muscleGroup,
            pageSize,
            offset
        ]);

        // 4. Ejecutamos el conteo con los mismos filtros para la paginación
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
        const { name, type, muscleGroup, equipment } = req.body || {};
        
        const imageFile = req.files["image"]?.[0];
        const videoFile = req.files["video"]?.[0];

        // 1. Obtener datos actuales de la DB
        const { rows: currentRows } = await pool.query(
            "SELECT avatar, avatar_thumbnail, video FROM exercises WHERE id = $1",
            [exerciseId]
        );

        if (currentRows.length === 0) return throwNotFoundError("Ejercicio no encontrado.");
        
        // IMPORTANTE: Extraemos los nombres actuales
        const oldAvatar = currentRows[0].avatar;
        const oldThumb = currentRows[0].avatar_thumbnail;
        const oldVideo = currentRows[0].video;

        const carpetaEjercicio = path.join(__dirname, `../uploads/exercises/${exerciseId}`);
        await fs.mkdir(carpetaEjercicio, { recursive: true });

        let nombreImagen = oldAvatar;
        let nombreThumb = oldThumb;
        let nombreVideo = oldVideo;

        // 3. Procesar Imagen (Si el usuario subió una nueva)
        if (imageFile) {
            // ELIMINACIÓN FÍSICA: Usamos los nombres que guardamos arriba
            if (oldAvatar) {
                const pathAvatar = path.join(carpetaEjercicio, oldAvatar);
                await fs.unlink(pathAvatar).catch(err => console.log("No se pudo borrar avatar viejo:", err.message));
            }
            if (oldThumb) {
                const pathThumb = path.join(carpetaEjercicio, oldThumb);
                await fs.unlink(pathThumb).catch(err => console.log("No se pudo borrar thumb viejo:", err.message));
            }

            // Nuevos nombres
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

        // 4. Procesar Video (Si el usuario subió uno nuevo)
        if (videoFile) {
            if (oldVideo) {
                const pathVideo = path.join(carpetaEjercicio, oldVideo);
                await fs.unlink(pathVideo).catch(err => console.log("No se pudo borrar video viejo:", err.message));
            }

            nombreVideo = `${Date.now()}-${videoFile.newFilename}`;
            const videoPath = path.join(carpetaEjercicio, nombreVideo);

            await fs.copyFile(videoFile.filepath, videoPath);
            await fs.unlink(videoFile.filepath);
        }

        // 5. DB Update
        const { rows } = await pool.query(
            `UPDATE exercises SET 
                name = COALESCE($1, name), 
                type = COALESCE($2, type),
                muscle_group = COALESCE($3, muscle_group), 
                equipment = COALESCE($4, equipment),
                avatar = $5, 
                avatar_thumbnail = $6, 
                video = $7
             WHERE id = $8 RETURNING *`,
            [name, type, muscleGroup, equipment, nombreImagen, nombreThumb, nombreVideo, exerciseId]
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