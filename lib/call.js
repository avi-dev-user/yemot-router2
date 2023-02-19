const responseFunctions = new (require('./response_functions'))();
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

        if (messages.some((message) => typeof message.type !== 'string')) {
            throw new InputValidationError('messages type must be string, one or more of the messages got type ' + typeof messages.type);
        }

        let responseText, valReturn;
        const send = async () => {
            if (!options.val_name) this.urlValueIndex++;

            const { responseText: _responseText, valReturn: _valReturn } = responseFunctions.make_read_response(messages, mode, options, this.urlValueIndex);
            valReturn = _valReturn;
            responseText = _responseText;

            if (this.globalResponseTxt) {
                responseText = this.globalResponseTxt + responseText;
                this.globalResponseTxt = '';
            }

            await this.blockRunningUntilNextRequest();

            this.send(responseText);

            await this.blockRunningUntilNextRequest();

            if (!this.req.query[valReturn]) {
                await send();
            }
        };

        await send();

        return this.req.query[valReturn] ?? false;
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
    * @param {[data]} message
    */
    async id_list_message (message, waitToMoreAction = false) {
        if (!Array.isArray(message)) {
            throw new Error('data is not array!!');
        }

        const responseTxt = responseFunctions.make_id_list_message_response(message);

        if (/(\.|=)g-.+/.test(responseTxt)) {
            this.logger('No further actions can be threaded after go_to_folder!', 'red');
            waitToMoreAction = false;
        }

        if (!waitToMoreAction) {
            // אם הפונקציה נקראה, לפני שהמשתמש ביקש תגובה
            // סימן שזוהי הפעולה האחרונה
            await this.blockRunningUntilNextRequest();

            this.send(responseTxt);

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

    setReqVals (req, res) {
        this.req = req;
        this.res = res;
        this.query = req.query;
        this.params = req.params;

        this.did = this.query.ApiDID;
        this.phone = this.query.ApiPhone;
        this.callId = this.query.ApiCallId;
        this.real_did = this.query.ApiRealDID;
        this.extension = this.query.ApiExtension;
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
