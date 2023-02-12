
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

module.exports = {
    HangupError,
    TimeoutError,
    ExitError
};