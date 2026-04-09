const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

exports.hashPassword = (password) => {
    return bcrypt.hashSync(password, 10);
}

exports.compareHashedPassword = (password, hashedPassword) => {
    return bcrypt.compareSync(password, hashedPassword)
}

exports.generateAccessToken = (user) => {
	return jwt.sign(
		{ id: user.id },
		process.env.ACCESS_TOKEN_SECRET,
		{ expiresIn: process.env.ACCESS_TOKEN_EXPIRATION_TIME }
	);
}

exports.generateRefreshToken = (user) =>{
	return jwt.sign(
		{ id: user.id },
		process.env.REFRESH_TOKEN_SECRET,
		{ expiresIn: process.env.REFRESH_TOKEN_EXPIRATION_TIME }
	);
}

exports.generateImageToken = (entityType, id, thumbnail = false) => {
	if (!validTypes.includes(entityType)) {
        throw new Error(`Invalid entity type: ${entityType}`);
    }
    const token = jwt.sign({ id, entityType }, SECRET, { expiresIn: "1h" });

    return `${process.env.BACKEND_URL}/images/${entityType}/${id}/avatar${thumbnail ? "/thumbnail" : ""}?token=${token}`;
}

exports.generatePasswordResetToken = () => {
    return crypto.randomBytes(20).toString("hex"); // Generates a random 40-character token
};
