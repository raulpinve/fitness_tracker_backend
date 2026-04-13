const fs = require("fs/promises");
const path = require("path");

exports.crearCarpeta = async (uploadDir) => {
    await fs.mkdir(uploadDir, { recursive: true });
};

exports.subirArchivo = (fileTempPath, uploadDir) => {
    return new Promise((resolve, reject) => {
        require("fs").rename(fileTempPath, uploadDir, (err) => {
            if (err) {
                return reject(err);
            }
            resolve(uploadDir);
        });
    });
};

exports.validateSizeFile = (file, maxSize) => {
    return file.size < maxSize * 1024 * 1024
}

exports.validateMimeTypeFile = (array, file) => {
    return array.includes(file.mimetype)
}

exports.eliminarArchivo = async (filePath) => {
    // Nada que eliminar
    if (!filePath || typeof filePath !== "string") {
        return true;
    }

    try {
        // Intentar eliminar directamente (más seguro que access + unlink)
        await fs.unlink(filePath);

        // Intentar eliminar el directorio padre si queda vacío
        const dirPath = path.dirname(filePath);

        try {
            const files = await fs.readdir(dirPath);
            if (files.length === 0) {
                await fs.rmdir(dirPath);
            }
        } catch (dirErr) {
            // Si el directorio no existe o no se puede leer → no es crítico
            if (dirErr.code !== "ENOENT") {
                // console.warn("No se pudo limpiar el directorio:", dirErr);
            }
        }

        return true;
    } catch (err) {
        // Archivo no existe → OK (idempotente)
        if (err.code === "ENOENT") return true;

        // console.error("Error al eliminar el archivo:", err);
        return false;
    }
};
