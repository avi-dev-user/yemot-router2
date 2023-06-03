class CallError extends Error {
    constructor ({ message, call }) {
        super();

        this.name = 'CallError';
        this.message = message;
        this.call = call;
        this.date = new Date();
        this.isCallError = true;
    }
}

class ExitError extends CallError {
    constructor (call, context) {
        super({ call });

        this.name = 'ExitError';
        this.context = context;
        this.message = 'the call was exited from the extension (by go_to_folder or id_list_message)';
        this.isExitError = true;
    }
}

class HangupError extends CallError {
    constructor () {
        super();

        this.name = 'HangupError';
        this.message = 'the call was hangup by the caller';
    }
}

class TimeoutError extends CallError {
    constructor (call, timeout) {
        super({ call });

        this.name = 'TimeoutError';
        this.timeout = timeout;
        this.message = 'timeout for receiving a response from the caller';
    }
}

module.exports = {
    HangupError,
    TimeoutError,
    ExitError,
    CallError
};