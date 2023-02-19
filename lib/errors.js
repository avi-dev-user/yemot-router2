
class ExitError extends Error {
    constructor (call, ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);

        this.call = call;

        this.name = 'ExitError';
        // Custom debugging information
        this.date = new Date();
    }
}

class HangupError extends ExitError {
    constructor (...params) {
        super(...params);
        this.name = 'HangupError';
    }
}

class TimeoutError extends ExitError {
    constructor (...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);
        this.name = 'TimeoutError';
    }
}

class InputValidationError extends Error {
    constructor (message, ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);
        this.name = 'ValidationError';
        this.message = message;
    }
}

module.exports = {
    HangupError,
    TimeoutError,
    ExitError,
    InputValidationError
};