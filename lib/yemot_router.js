const { HangupError, TimeoutError, ExitError } = require('./errors.js');
const Call = require('./call');
const Router = require('express').Router;
const EventEmitter = require('events');
const colors = require('colors');

function YemotRouter (options = {}) {
    const ops = {
        printLog: options.printLog || false,
        timeout: options.timeout || 0,
        uncaughtErrorsHandler: options.uncaughtErrorsHandler || null
    };

    if (ops.timeout && Number.isNaN(ops.timeout)) {
        throw new Error('YemotRouter: if you set timeout option, it must be a number');
    }

    const activeCalls = {};
    const eventsEmitter = new EventEmitter();

    function logger (callId, msg, color = 'blue') {
        if (!ops.printLog) return;
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
                logger(callId, 'timeout for receiving a response from the caller. the call has been deleted from active calls');
            } else if (error instanceof ExitError) {
                logger(callId, '👋 call is exit');
            } else {
                if (ops.uncaughtErrorsHandler) {
                    logger(callId, '💥 Uncaught error. applying uncaughtErrorsHandler', 'red');
                    try {
                        await ops.uncaughtErrorsHandler(error, call);
                    } catch (err) {
                        if (err instanceof ExitError) {
                            console.log('👋 the call was exited from the extension in uncaughtErrorsHandler');
                        } else {
                            console.error('💥 Error in uncaughtErrorsHandler! crashing the process');
                            throw err;
                        }
                    }
                } else {
                    logger(callId, '💥 Uncaught error. no uncaughtErrorsHandler, throwing error', 'red');
                    throw error;
                }
            }
        }
    }

    return new Proxy(Router(), {
        get: function (target, propName) {
            if (['get', 'post', 'all', 'add_fn'].includes(propName)) {
                return (path, fn) => {
                    target[propName === 'add_fn' ? 'all' : propName](path, (req, res, next) => {
                        if (propName === 'add_fn') {
                            console.warn('[warning] add_fn is deprecated, use get/post/all instead');
                        }

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
                            currentCall = new Call(callId, eventsEmitter, ops);
                            activeCalls[callId] = currentCall;
                            logger(callId, `📞 new call - from ${values.ApiPhone}`);
                        }

                        currentCall.setReqValues(req, res);

                        if (isNewCall) {
                            makeNewCall(fn, callId, currentCall);
                        } else {
                            eventsEmitter.emit(callId, values.hangup === 'yes');
                        }
                    });
                };
            } else {
                return target[propName];
            }
        }
    });
}

module.exports = YemotRouter;
