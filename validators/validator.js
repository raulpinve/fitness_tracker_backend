
exports.validateUUID = (value) => {
    if (!value || typeof value !== "string") return false;

    const uuidV7Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    return uuidV7Regex.test(value);
};
