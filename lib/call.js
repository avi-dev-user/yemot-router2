const { makeMessagesData, makeReadResponse } = require('./response_functions');
const { HangupError, TimeoutError, ExitError, InputValidationError } = require('./errors');
const colors = require('colors');

function shiftDuplicatedValues (values) {
    /** אם יש ערך מסויים כמה פעמים, שייקבע רק האחרון **/
    for (const key of Object.keys(values)) {
        const value = values[key];
        if (Array.isArray(value)) {
            values[key] = value[value.length - 1];
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

        this._vaNameIndex = 0;
        this._responsesTextQueue = '';
        this.responsesTextQueue = {
            pull: () => {
                const queueText = this._responsesTextQueue;
                this._responsesTextQueue = '';
                return queueText;
            },
            push: (newResText) => {
                this._responsesTextQueue += `${newResText}&`;
            }
        };
    }

    logger (msg, color = 'blue') {
        if (!this.ops.printLog) return;
        console.log(colors[color](`[${this.callId}]: ${msg}`));
    }

    async read (messages, mode = 'tap', options = {}) {
        if (!Array.isArray(messages)) {
            throw new InputValidationError(`messages must be array, got ${typeof messages}`);
        }

        if (!messages.length) {
            throw new InputValidationError('messages must not be empty array');
        }

        if (messages.some((message) => typeof message !== 'object')) {
            throw new InputValidationError(`message must be object, one or more of the messages got type ${typeof messages}`);
        }

        if (messages.some((message) => typeof message.type !== 'string')) {
            throw new InputValidationError(`message type must be string, one or more of the messages got type ${typeof messages.type}`);
        }

        messages.forEach((message) => {
            if (message.type !== 'zmanim' && message.type !== 'music_on_hold') {
                if (typeof message.data !== 'string') throw new InputValidationError(`message (in type ${message.type}) data must be string, got ${typeof message.data}`);
            }
        });

        let responseText, valName;
        const sendResp = async () => {
            if (!options.val_name) this._vaNameIndex++;

            ({ responseText, valName } = makeReadResponse(messages, mode, options, this._vaNameIndex));

            this.send(this.responsesTextQueue.pull() + responseText);

            await this.blockRunningUntilNextRequest();

            if (!this.values[valName]) {
                await sendResp();
            }
        };

        await sendResp();

        return this.values[valName] ?? false;
    }

    go_to_folder (target) {
        const responseTxt = `go_to_folder=${target}`;
        this.send(this.responsesTextQueue.pull() + responseTxt);
        throw new ExitError(this, { target, caller: 'go_to_folder' });
    }

    restart_ext () {
        const currentFolder = this.extension;
        return this.go_to_folder(`/${currentFolder}`);
    }

    hangup () {
        return this.go_to_folder('hangup');
    }

    /**
    * @param {[data]} messages
    * @param {Object} options
    * @param {Boolean} options.prependToNextAction
    * @param {Boolean} options.removeInvalidChars
    */
    id_list_message (messages, options = {}) {
        if (!Array.isArray(messages)) {
            throw new InputValidationError(`messages must be array, got ${typeof messages}.\nmessages got: ${JSON.stringify(messages)}`);
        }

        if (!['object', 'undefined'].includes(typeof options)) {
            throw new InputValidationError(`if you pass options argument to id_list_message it must be object, but got ${typeof options} ('${options}')`);
        }

        const { prependToNextAction = false } = options;

        if (prependToNextAction && messages.some((message) => message?.type === 'go_to_folder')) {
            throw new InputValidationError('if you use go_to_folder message type in id_list_message you can\'t use prependToNextAction=true!');
        }

        const goToFolderMessageIndex = messages.findIndex((message) => message?.type === 'go_to_folder');
        if (goToFolderMessageIndex !== -1 && goToFolderMessageIndex !== messages.length - 1) {
            throw new InputValidationError('go_to_folder message type must be the last message in id_list_message. No further messages can be threaded after this message type');
        }

        const responseTxt = 'id_list_message=' + makeMessagesData(messages, options.removeInvalidChars ?? false);

        if (prependToNextAction) {
            this.responsesTextQueue.push(responseTxt);
        } else {
            if (this.res._headerSent) {
                this.logger('Cannot send id_list_message after sending response (probably done from uncaughtErrorsHandler due to error in asynchronous code after returning response)', 'red');
                return;
            }
            this.send(this.responsesTextQueue.pull() + responseTxt + '&');
            throw new ExitError(this, {
                target: goToFolderMessageIndex !== -1 ? messages[goToFolderMessageIndex].data : `parent of ${this.extension}`,
                caller: goToFolderMessageIndex !== -1 ? 'go_to_folder' : 'id_list_message'
            });
        }
    }

    routing_yemot (number) {
        const responseTxt = `routing_yemot=${number}`;
        this.send(this.responsesTextQueue.pull() + responseTxt);
        throw new ExitError(this, { target: `other system - ${number}`, caller: 'routing_yemot' });
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
