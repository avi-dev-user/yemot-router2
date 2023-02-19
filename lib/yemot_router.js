const { HangupError, TimeoutError, ExitError } = require('./errors.js');
const Call = require('./call');
const Router = require('express').Router;
const EventEmitter = require('events');
const colors = require('colors');

function shiftDuplicatedFromQuery (query) {
    /** אם ערך מסויים יש כמה פעמים, שייקבע רק האחרון **/
    for (const key of Object.keys(query)) {
        const iterator = query[key];
        if (Array.isArray(iterator)) {
            query[key] = iterator[iterator.length - 1];
        }
    }
    return query;
}

function YemotRouter (options = {}) {
    const ops = {
        printLog: options.printLog || false,
        timeout: options.timeout || 0,
        uncaughtErrorsHandler: options.uncaughtErrorsHandler || null
    };
    const activeCalls = {};
    const eventsEmitter = new EventEmitter();

    function logger (callId, msg, color = 'blue') {
        if (!ops.printLog) return;
        console.log(colors[color](`[${callId}]: ${msg}`));
    }

    function onFnDone (callId) {
        delete activeCalls[callId];
        logger(callId, '🆗 the function is done');
    }

    function onExit (callId) {
        delete activeCalls[callId];
        logger(callId, '👋 call is exit!');
    }

    function onHangup (callId) {
        delete activeCalls[callId];
        logger(callId, '👋 call is hangup!');
    }

    function onTimeout (callId) {
        delete activeCalls[callId];
        logger(callId, 'call is timeout!', 'red');
    }

    async function makeNewCall (fn, callId, call) {
        try {
            await fn(call);
            onFnDone(callId);
        } catch (error) {
            // טיפול בשגיאות מלאכותיות שנועדו לעצור את ריצת הפונקציה - בניתוק לדוגמה
            if (error instanceof HangupError) {
                onHangup(callId);
            } else if (error instanceof TimeoutError) {
                onTimeout(callId);
            } else if (error instanceof ExitError) {
                onExit(callId);
            } else {
                if (ops.uncaughtErrorsHandler) {
                    logger(callId, '💥 Uncaught error. applying uncaughtErrorsHandler', 'red');
                    ops.uncaughtErrorsHandler(error, call);
                    delete activeCalls[callId];
                } else {
                    logger(callId, '💥 Uncaught error. no uncaughtErrorsHandler, throwing error', 'red');
                    throw error;
                }
            }
        }
    }

    return new Proxy(Router(), {
        get: function (target, prop) {
            if (['get', 'post', 'all', 'add_fn'].includes(prop)) {
                return (path, fn) => {
                    target[prop === 'add_fn' ? 'all' : prop](path, (req, res, next) => {
                        if (prop === 'add_fn') {
                            console.warn('[warning] add_fn is deprecated, use get/post/all instead');
                        }
                        const requiredValues = ['ApiPhone', 'ApiDID', 'ApiExtension', 'ApiCallId'];
                        if (requiredValues.some((key) => !Object.prototype.hasOwnProperty.call(req.query, key))) {
                            return res.json({ message: 'request is not valid yemot request' });
                        }

                        req.query = shiftDuplicatedFromQuery(req.query);

                        const callId = req.query.ApiCallId;

                        let isNewCall = false;
                        let currentCall = activeCalls[callId];
                        if (!currentCall) {
                            isNewCall = true;
                            currentCall = new Call(callId, eventsEmitter, ops);
                            activeCalls[callId] = currentCall;
                            logger(callId, `📞 new call from ${req.query.ApiPhone}`);
                        }

                        currentCall.setReqVals(req, res);

                        if (isNewCall) {
                            makeNewCall(fn, callId, currentCall);
                        } else {
                            eventsEmitter.emit(callId, req.query.hangup === 'yes');
                        }
                    });
                };
            } else {
                return target[prop];
            }
        }
    });
}

module.exports = YemotRouter;
