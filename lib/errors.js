class BaseError extends Error {
    constructor (call, ...params) {
        super(...params);

        this.call = call;
        this.date = new Date();
        this.isInternalError = true;
    }
}

class ExitError extends BaseError {
    constructor (call, context, ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(call, ...params);

        this.name = 'ExitError';
        this.context = context;
        this.message = 'the call was exited from the extension (by go_to_folder or id_list_message)';
        this.isExitError = true;
    }
}

class HangupError extends BaseError {
    constructor (timeout, ...params) {
        super(...params);

        this.name = 'HangupError';
        this.message = 'the call was hangup by the caller';
        this.isHangupError = true;
    }
}

class TimeoutError extends BaseError {
    constructor (call, timeout, ...params) {
        super(call, ...params);

        this.name = 'TimeoutError';
        this.timeout = timeout;
        this.message = 'timeout for receiving a response from the caller';
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