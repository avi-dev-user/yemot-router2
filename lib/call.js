const { makeReadResponse, makeIdListMessageResponse } = require('./response_functions');
const { HangupError, TimeoutError, ExitError, InputValidationError } = require('./errors');
const colors = require('colors');

class Call {
    constructor (callId, eventsEmitter, options) {
        this.ops = options;
        this.eventsEmitter = eventsEmitter;

        this.callId = callId;
        this.did = '';
        this.phone = '';
        this.real_did = '';
        this.extension = '';

        this.urlValueIndex = 0;
        this.globalResponseTxt = '';
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
            if (!options.val_name) this.urlValueIndex++;

            ({ responseText, valName } = makeReadResponse(messages, mode, options, this.urlValueIndex));

            if (this.globalResponseTxt) {
                responseText = this.globalResponseTxt + responseText;
                this.globalResponseTxt = '';
            }

            this.send(responseText);

            await this.blockRunningUntilNextRequest();

            const values = this.req.method === 'POST' ? this.req.body : this.req.query;
            if (!values[valName]) {
                await sendResp();
            }
        };

        await sendResp();

        const values = this.req.method === 'POST' ? this.req.body : this.req.query;
        return values[valName] ?? false;
    }

    go_to_folder (folder) {
        let responseTxt = `go_to_folder=${folder}`;

        if (this.globalResponseTxt) {
            responseTxt = this.globalResponseTxt + responseTxt;
            this.globalResponseTxt = '';
        }

        this.send(responseTxt);

        throw new ExitError(this);
    }

    restart_ext () {
        const folder = this.extension;
        let responseTxt = `go_to_folder=/${folder}`;

        if (this.globalResponseTxt) {
            responseTxt = this.globalResponseTxt + responseTxt;
            this.globalResponseTxt = '';
        }

        this.send(responseTxt);
    }

    /**
    * @param {[data]} messages
    */
    async id_list_message (messages, waitToMoreAction = false) {
        if (!Array.isArray(messages)) {
            throw new InputValidationError(`messages must be array, got ${typeof messages}.\nmessages got: ${JSON.stringify(messages)}`);
        }

        const responseTxt = makeIdListMessageResponse(messages);

        if (/(\.|=)g-.+/.test(responseTxt)) {
            this.logger('No further actions can be threaded after go_to_folder!', 'red');
            waitToMoreAction = false;
        }

        if (!waitToMoreAction) {
            // אם הפונקציה נקראה, לפני שהמשתמש ביקש תגובה
            // סימן שזוהי הפעולה האחרונה
            await this.blockRunningUntilNextRequest();

            this.send(responseTxt);
            if (this.res._headerSent) return; // for id_list_message in uncaughtErrorsHandler

            throw new HangupError(this);
        } else {
            this.globalResponseTxt = responseTxt;
        }
    }

    routing_yemot (phone) {
        let responseTxt = 'routing_yemot=' + phone;

        if (this.globalResponseTxt) {
            responseTxt = this.globalResponseTxt + responseTxt;
            this.globalResponseTxt = '';
        }

        this.send(responseTxt);
    }

    setReqValues (req, res) {
        this.req = req;
        this.res = res;
        this.query = req.query;
        this.body = req.body;
        this.params = req.params;

        const values = this.req.method === 'POST' ? this.req.body : this.req.query;

        this.did = values.ApiDID;
        this.phone = values.ApiPhone;
        this.callId = values.ApiCallId;
        this.real_did = values.ApiRealDID;
        this.extension = values.ApiExtension;

        const queryToCopy = Object.keys(values).filter((key) => key.startsWith('Api'));
        for (const key of queryToCopy) {
            this[key] = values[key];
        }
    }

    send (data) {
        this.res.send(data);
    }

    async blockRunningUntilNextRequest () {
        if (this.ops.printLog) this.logger('🔒 fn running blocked - waiting to next request from yemot');
        return new Promise((resolve, reject) => {
            if (this.ops.timeout) {
                clearTimeout(this._timeoutId);
                this._timeoutId = setTimeout(() => {
                    if (!this.res._headerSent) this.res.json({ message: 'timeout' });
                    reject(new TimeoutError(this));
                }, this.ops.timeout);
            }
            this.eventsEmitter.once(this.callId, (isHangup) => {
                this.logger('🔓 fn running unblocked');
                if (this._timeoutId) {
                    clearTimeout(this._timeoutId);
                };
                if (isHangup) {
                    if (!this.res._headerSent) this.res.json({ message: 'hangup' });
                    reject(new HangupError(this));
                } else {
                    resolve(isHangup);
                }
            });
        });
    }
}

module.exports = Call;
