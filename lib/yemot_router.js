const { HangupError, TimeoutError, ExitError, InputValidationError } = require('./errors.js');
const Call = require('./call');
const Router = require('express').Router;
const EventEmitter = require('events');
const colors = require('colors');
const globalDefaults = require('./defaults.js');
const ms = require('ms');

function YemotRouter (options = {}) {
    const ops = {
        printLog: options.printLog,
        timeout: options.timeout,
        uncaughtErrorHandler: options.uncaughtErrorHandler || null,
        defaults: options.defaults || {}
    };

    if (typeof ops.timeout !== 'undefined' && !ms(ops.timeout)) {
        throw new Error('YemotRouter: timeout must be a valid ms liberty string/milliseconds number');
    }

    if (ops.defaults.id_list_message?.prependToNextAction) {
        throw new Error('YemotRouter: prependToNextAction is not supported as default');
    }

    const mergedDefaults = {
        common: {
            printLog: ops.printLog ?? globalDefaults.common.printLog
        },
        read: {
            timeout: ops.timeout ?? globalDefaults.read.timeout,
            tap: {
                ...globalDefaults.read.tap,
                ...ops.defaults.read?.tap
            },
            stt: {
                ...globalDefaults.read.stt,
                ...ops.defaults.read?.stt
            },
            record: {
                ...globalDefaults.read.record,
                ...ops.defaults.read?.record
            }
        },
        id_list_message: {
            ...globalDefaults.id_list_message,
            ...ops.defaults.id_list_message
        }
    };

    const activeCalls = {};
    const eventsEmitter = new EventEmitter();

    function logger (callId, msg, color = 'blue') {
        if (!(ops.printLog ?? mergedDefaults.read.timeout)) return;
        console.log(colors[color](`[${callId}]: ${msg}`));
    }

    function deleteCall (callId) {
        if (activeCalls[callId]?._timeoutId) {
            clearTimeout(activeCalls[callId]._timeoutId);
        }
        delete activeCalls[callId];
    }

    async function makeNewCall (fn, callId, call) {
        try {
            await fn(call);
            deleteCall(callId);
            logger(callId, '🆗 the function is done');
        } catch (error) {
            deleteCall(callId);

            // טיפול בשגיאות מלאכותיות שנועדו לעצור את ריצת הפונקציה - בניתוק לדוגמה
            if (error instanceof HangupError) {
                logger(callId, '👋 the call was hangup by the caller');
            } else if (error instanceof TimeoutError) {
                logger(callId, `💣 timeout for receiving a response from the caller (after ${ms(error.timeout, { long: true })}). the call has been deleted from active calls`);
            } else if (error instanceof ExitError) {
                logger(callId, `👋 the call was exited from the extension /${call.extension}` + (error.context ? ` (by ${error.context?.caller} to ${error.context?.target})` : ''));
            } else {
                if (ops.uncaughtErrorHandler) {
                    logger(callId, '💥 Uncaught error. applying uncaughtErrorHandler', 'red');
                    try {
                        await ops.uncaughtErrorHandler(error, call);
                    } catch (err) {
                        if (err instanceof ExitError) {
                            console.log(`👋 the call was exited from the extension /${call.extension} in uncaughtErrorHandler` + (error.context ? ` (by ${error.context?.caller} to ${error.context?.target})` : ''));
                        } else {
                            console.error('💥 Error in uncaughtErrorHandler! crashing the process');
                            throw err;
                        }
                    }
                } else {
                    logger(callId, '💥 Uncaught error. no uncaughtErrorHandler, throwing error', 'red');
                    throw error;
                }
            }
        }
    }

    return new Proxy(Router(options), {
        get: function (target, propName) {
            if (propName === 'add_fn') {
                throw new Error('YemotRouter: router.add_fn is deprecated, use get/post/all instead');
            } else if (['get', 'post', 'all'].includes(propName)) {
                return (path, fn) => {
                    target[propName](path, (req, res, next) => {
                        if (req.method === 'POST' && !req.body) {
                            throw new Error('YemotRouter: it look you use api_url_post=yes, but you didn\'t include express.urlencoded({ extended: true }) middleware! (https://expressjs.com/en/4x/api.html#express.urlencoded)');
                        }

                        const values = req.method === 'POST' ? req.body : req.query;
                        const requiredValues = ['ApiPhone', 'ApiDID', 'ApiExtension', 'ApiCallId'];
                        if (requiredValues.some((key) => !Object.prototype.hasOwnProperty.call(values, key))) {
                            return res.json({ message: 'the request is not valid yemot request' });
                        }

                        const callId = values.ApiCallId;

                        let isNewCall = false;
                        let currentCall = activeCalls[callId];
                        if (!currentCall) {
                            isNewCall = true;
                            if (values.hangup === 'yes') {
                                logger(callId, '👋 call is hangup (outside the function)');
                                return res.json({ message: 'hangup' });
                            }
                            currentCall = new Call(callId, eventsEmitter, mergedDefaults);
                            activeCalls[callId] = currentCall;
                            logger(callId, `📞 new call - from ${values.ApiPhone || 'AnonymousPhone'}`);
                        }

                        currentCall.setReqValues(req, res);

                        if (isNewCall) {
                            makeNewCall(fn, callId, currentCall);
                        } else {
                            eventsEmitter.emit(callId, values.hangup === 'yes');
                        }
                    });
                };
            } else if (propName === 'deleteCall') {
                return deleteCall;
            } else if (propName === 'defaults') {
                return mergedDefaults;
            } else {
                return target[propName];
            }
        },
        set: function (target, propName, value) {
            if (propName === 'defaults') {
                if (value.id_list_message?.prependToNextAction) {
                    throw new InputValidationError('prependToNextAction is not supported as default');
                }
                if (typeof value.read?.timeout !== 'undefined' && !ms(value.read.timeout)) {
                    throw new InputValidationError('timeout must be a valid ms liberty string/milliseconds number');
                }

                target.defaultsOptions = {
                    ...mergedDefaults,
                    ...value
                };
            } else {
                target[propName] = value;
                return true;
            }
        }
    });
}

module.exports = YemotRouter;
