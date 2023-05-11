
class ExitError extends Error {
    constructor (call, ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);

        this.name = 'ExitError';
        this.message = 'the call was exited from the extension (by go_to_folder)';
        this.call = call;
        this.date = new Date();
        this.isExitError = true;
    }
}

class HangupError extends ExitError {
    constructor (call, ...params) {
        super(...params);
        this.name = 'HangupError';
        this.message = 'the call was hangup by the caller';
        this.call = call;
        this.isHangupError = true;
    }
}

class TimeoutError extends ExitError {
    constructor (call, ...params) {
        super(...params);
        this.name = 'TimeoutError';
        this.message = 'timeout for receiving a response from the caller';
        this.call = call;
        this.isTimeoutError = true;
    }
}

class InputValidationError extends Error {
    constructor (message, ...params) {
        super(...params);
        this.name = 'InputValidationError';
        this.message = message;
        this.isInputValidationError = true;
    }
}

module.exports = {
    HangupError,
    TimeoutError,
    ExitError,
    InputValidationError
};