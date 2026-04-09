exports.snakeToCamel = (obj) => {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
            key.replace(/(_\w)/g, match => match[1].toUpperCase()), 
            value
        ])
    );
}