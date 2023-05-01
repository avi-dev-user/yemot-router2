const { makeReadResponse, makeIdListMessageResponse } = require('./response_functions');
const { HangupError, TimeoutError, ExitError, InputValidationError } = require('./errors');
const colors = require('colors');

function shiftDuplicatedValues (values) {
    /** אם יש ערך מסויים כמה פעמים, שייקבע רק האחרון **/
    for (const key of Object.keys(values)) {
        const iterator = values[key];
        if (Array.isArray(iterator)) {
            values[key] = iterator[iterator.length - 1];
        }
    }
    return values;
}

class Call {
    constructor (callId, eventsEmitter, options) {
        this.ops = options;
        this.eventsEmitter = eventsEmitter;

        this.callId = callId;
        this.did = '';
        this.phone = '';
        this.real_did = '';
        this.extension = '';

        this._urlValueIndex = 0;
        this._globalResponseTxt = '';
    }

    logger (msg, color = 'blue') {
        if (!this.ops.printLog) return;
        console.log(colors[color](`[${this.callId}]: ${msg}`));
    }

    async read (messages, mode = 'tap', options = {}) {
        if (!Array.isArray(messages)) {
            throw new InputValidationError('messages must be array, got ' + typeof messages);
        }

        if (!messages.length) {
            throw new InputValidationError('data must be array with at least one item');
        }

        if (messages.some((messages) => typeof messages.type !== 'string')) {
            throw new InputValidationError('messages type must be string, one or more of the messages got type ' + typeof messages.type);
        }

        let responseText, valName;
        const sendResp = async () => {
            if (!options.val_name) this._urlValueIndex++;

            ({ responseText, valName } = makeReadResponse(messages, mode, options, this._urlValueIndex));

            if (this._globalResponseTxt) {
                responseText = this._globalResponseTxt + responseText;
                this._globalResponseTxt = '';
            }

            await this.blockRunningUntilNextRequest();

            this.send(responseText);

            await this.blockRunningUntilNextRequest();

            if (!this.values[valName]) {
                await sendResp();
            }
        };

        await sendResp();

        return this.values[valName] ?? false;
    }

    go_to_folder (folder) {
        let responseTxt = `go_to_folder=${folder}`;

        if (this._globalResponseTxt) {
            responseTxt = this._globalResponseTxt + responseTxt;
            this._globalResponseTxt = '';
        }

        this.send(responseTxt);

        throw new ExitError(this);
    }

    restart_ext () {
        const folder = this.extension;
        let responseTxt = `go_to_folder=/${folder}`;

        if (this._globalResponseTxt) {
            responseTxt = this._globalResponseTxt + responseTxt;
            this._globalResponseTxt = '';
        }

        this.send(responseTxt);
    }

    hangup () {
        return this.go_to_folder('hangup');
    }

    /**
    * @param {[data]} messages
    * @param {Object} options
    * @param {Boolean} options.mergeToNext
    * @param {Boolean} options.removeInvalidChars
    */
    async id_list_message (messages, options = {}) {
        if (!Array.isArray(messages)) {
            throw new InputValidationError(`messages must be array, got ${typeof messages}.\nmessages got: ${JSON.stringify(messages)}`);
        }

        let { mergeToNext = false } = options;

        const responseTxt = makeIdListMessageResponse(messages, options.removeInvalidChars ?? false);

        if (/(\.|=)g-.+/.test(responseTxt)) {
            this.logger('No further actions can be threaded after go_to_folder!', 'red');
            mergeToNext = false;
        }

        if (!mergeToNext) {
            // אם הפונקציה נקראה, לפני שהמשתמש ביקש תגובה
            // סימן שזוהי הפעולה האחרונה
            await this.blockRunningUntilNextRequest();

            this.send(responseTxt);
            if (this.res._headerSent) return; // for id_list_message in uncaughtErrorsHandler

            throw new HangupError(this);
        } else {
            this._globalResponseTxt = responseTxt;
        }
    }

    routing_yemot (number) {
        let responseTxt = 'routing_yemot=' + number;

        if (this._globalResponseTxt) {
            responseTxt = this._globalResponseTxt + responseTxt;
            this._globalResponseTxt = '';
        }

        this.send(responseTxt);
    }

    setReqValues (req, res) {
        this.req = req;
        this.res = res;

        this.values = req.method === 'POST' ? req.body : req.query;
        this.values = shiftDuplicatedValues(this.values);

        this.phone = this.values.ApiPhone;
        this.callId = this.values.ApiCallId;
        this.did = this.values.ApiDID;
        this.real_did = this.values.ApiRealDID;
        this.extension = this.values.ApiExtension;

        const queryToInject = Object.keys(this.values).filter((key) => key.startsWith('Api'));
        for (const key of queryToInject) {
            this[key] = this.values[key];
        }
    }

    send (data) {
        this.res.send(data);
    }

    async blockRunningUntilNextRequest () {
        if (!this.res._headerSent) return; // TODO: check if this is needed. legacy code
        if (this.ops.printLog) this.logger('🔒 fn running blocked - wait to next request from yemot');
        return new Promise((resolve, reject) => {
            this.eventsEmitter.once(this.callId, (isHangup) => {
                this.logger('🔓 fn running unblocked');
                if (this.ops.timeout) {
                    setTimeout(() => {
                        this.onTimeout(reject);
                    }, this.ops.timeout);
                }
                if (isHangup) {
                    this.onHangup(reject);
                } else {
                    resolve(isHangup);
                }
            });
        });
    }

    onHangup (reject) {
        this.res.json({ message: 'hangup' });
        reject(new HangupError(this));
    }

    onTimeout (reject) {
        this.res.json({ message: 'timeout' });
        reject(new TimeoutError(this));
    }
}

module.exports = Call;
