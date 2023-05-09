const { HangupError, TimeoutError, ExitError } = require('./errors.js');
const Call = require('./call');
const Router = require('express').Router;
const EventEmitter = require('events');
const colors = require('colors');

function shiftDuplicatedValues (query) {
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
                logger(callId, '👋 call is hangup');
            } else if (error instanceof TimeoutError) {
                logger(callId, 'the timeout for the caller\'s answer has expired. the call function has killed and been removed from the active calls');
            } else if (error instanceof ExitError) {
                logger(callId, '👋 call is exit');
            } else {
                if (ops.uncaughtErrorsHandler) {
                    logger(callId, '💥 Uncaught error. applying uncaughtErrorsHandler', 'red');
                    ops.uncaughtErrorsHandler(error, call);
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

                        if (req.method === 'POST') {
                            req.body = shiftDuplicatedValues(req.body);
                        } else {
                            req.query = shiftDuplicatedValues(req.query);
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

                        if (req.method === 'POST') {
                            const _query = req.query;
                            const proxy = new Proxy(_query, {
                                get: function (target, propName) {
                                    console.warn(`[${req.path}] You are trying to access the '${propName}' property on the request query string object, but you have set the 'api_url_post=yes' option. This means that the yemot values will be in the request body object, not the request query object.\nPlease update your code accordingly - instead of call.req.query.propName, use call.req.body.propName.`);
                                    return target[propName];
                                }
                            });
                            req.query = proxy;
                            currentCall.query = proxy;
                        } else {
                            const _body = req.body;
                            const proxy = new Proxy(_body, {
                                get: function (target, propName) {
                                    if (!target[propName]) console.warn(`[${req.path}] If you do not use the api_url_post=yes option, the values will be in the call.req.query object, not the call.req.body object.\nPlease update your code accordingly - instead of call.req.body.propName, use call.req.query.propName, or use the api_url_post=yes option.`);
                                    return target[propName];
                                }
                            });
                            req.body = proxy;
                            currentCall.body = proxy;
                        }

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
