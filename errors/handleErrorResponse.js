// Import functions to handle specific errors
const handleHTTPThrowErrors = require('./handleHTTPThrowErrors')

// Main function to handle error responses of the application
const handleErrorResponse = (err, req, res, next) => {  
    let errorObject; 
    
    if (err.type === 'entity.parse.failed') {
        errorObject = handleHTTPThrowErrors.handleBadRequestError("JSON inválido o vacío");
        return res.status(errorObject.statusCode).json(errorObject);
    }

    if (err.code) {
        switch (err.code) {

            case "23505":
                errorObject = handleHTTPThrowErrors.handleConflictError(
                    "Ya existe un registro con estos datos."
                );
                return res.status(errorObject.statusCode).json(errorObject);

            case "23503":
                errorObject = handleHTTPThrowErrors.handleBadRequestError(
                    "Referencia inválida (foreign key)."
                );
                return res.status(errorObject.statusCode).json(errorObject);
        }
    }

    switch (err.name) {
        /** === HTTP Errors === */
        // Error 400: Handle bad request errors
        case 'BadRequestError':
            errorObject = handleHTTPThrowErrors.handleBadRequestError(err.message, err.field);
            break;
        case 'BadRequestErrorMultiple':
            errorObject = handleHTTPThrowErrors.handleBadRequestErrorMultiple(err.errors, err.message);
            break

        // Error 401: Handle unauthorized user errors
        case 'UnauthorizedError':
            errorObject = handleHTTPThrowErrors.handleUnauthorizedError(err.message);
        break;

        // Error 404: Handle not found errors
        case 'NotFoundError':
            errorObject = handleHTTPThrowErrors.handleNotFound(err.message);
            break;
   
        // Error 403: Handle forbidden access to resources
        case 'ForbiddenError':
            errorObject = handleHTTPThrowErrors.handleForbiddenError(err.message);
            break;
        
        // Error 409: handle confict error
        case 'ConflictError': 
            errorObject = handleHTTPThrowErrors.handleConflictError(err.message, err.field);
            break;

        // Error 410: handle gone resources
        // case 'GoneError': 
        //     errorObject = handleHTTPThrowErrors.handleGoneError(err.message)

        // Error 500: Handle server errors
        case 'ServerError':
            errorObject = handleHTTPThrowErrors.handleDefaultErrorResponse(err.message)
            break
    
        default:
            console.log(err)
            // Handle any other type of error with default response
            errorObject = handleHTTPThrowErrors.handleDefaultErrorResponse()
            break;
    }
    // Return the response with the status code and error object
    return res.status(errorObject.statusCode).json( errorObject );
}

// Export the error response handling function
module.exports = handleErrorResponse
