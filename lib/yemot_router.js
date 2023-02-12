const { HangupError, TimeoutError, ExitError } = require('./errors.js');
const Call = require('./call');

const Router = require('express').Router;
const EventEmitter = require('events');

function YemotRouter (options = {}) {
    const router = Router();
    const events = new EventEmitter();
    const activeCalls = {};

    Object.setPrototypeOf(Router, YemotRouter);

    router.add_fn = function (path, fn) {
        this.all(path, (req, res, next) => {
            const requiredValues = ['ApiPhone', 'ApiDID', 'ApiExtension', 'ApiCallId'];
            if (false && requiredValues.some((key) => !Object.prototype.hasOwnProperty.call(req.query, key))) {
                return res.json({ message: 'request is not valid' }, 400);
            }

            req.query = removeDuplicatedFromQuery(req.query);

            const callId = req.query.ApiCallId;

            const [currentCall, isNewCall] = getCurrentCall(callId);

            currentCall.get_req_vals(req, res, next);

            if (isNewCall) {
                newCall(fn, callId, currentCall);
            } else {
                events.emit(callId, isHangup(currentCall.query));
            }
        });
    };

    async function newCall (fn, callId, call) {
        try {
            const r = await fn(call);
            onCallEnd(callId, r);
        } catch (error) {
            if (error instanceof HangupError) {
                onHangup(callId);
            } else if (error instanceof TimeoutError) {
                onTimeout(callId);
            } else if (error instanceof ExitError) {
                onExit(callId);
            } else {
                throw error;
            }
        }
    }

    function onCallEnd (callId, r) {
        delete activeCalls[callId];
        console.log(callId, 'deleted', r);
    }

    function onExit (callId) {
        delete activeCalls[callId];
        console.log(callId, 'exit');
    }

    function onHangup (callId) {
        delete activeCalls[callId];
        console.log(callId, 'hangup');
    }

    function onTimeout (callId) {
        delete activeCalls[callId];
        console.error(callId, 'is timeout!');
    }

    function isHangup (query) {
        if (query.hangup && query.hangup === 'yes') {
            return true;
        }
        return false;
    }

    function getCurrentCall (callId) {
        function makeNewCall () {
            const call = new Call(callId, events, options.timeout || 0);
            activeCalls[callId] = call;
            console.log(callId + ' is new');
            return call;
        }

        let isNewCall = false;
        let currentCall = activeCalls[callId];
        if (!currentCall) {
            isNewCall = true;
            currentCall = makeNewCall();
        }
        return [currentCall, isNewCall];
    }

    /** אם ערך מסויים יש כמה פעמים, שייקבע רק האחרון **/
    function removeDuplicatedFromQuery (query) {
        for (const key of Object.keys(query)) {
            const iterator = query[key];
            if (Array.isArray(iterator)) {
                query[key] = iterator[iterator.length - 1];
            }
        }
        return query;
    }

    return router;
}

YemotRouter.YemotRouter = YemotRouter;
YemotRouter.errors = { HangupError, TimeoutError, ExitError };

module.exports = YemotRouter;
