const { makeMessagesData, makeTapModeRead, makeSttModeRead, makeRecordModeRead } = require('./response_functions');
const { HangupError, TimeoutError, ExitError } = require('./errors');
const colors = require('colors');
const ms = require('ms');

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
    #eventsEmitter;
    #defaults;
    #valNameIndex;
    #timeoutId;
    #_responsesTextQueue;
    #responsesTextQueue;
    #values;

    constructor (callId, eventsEmitter, defaults) {
        this.#eventsEmitter = eventsEmitter;
        this.#defaults = defaults;

        this.callId = callId;
        this.did = '';
        this.phone = '';
        this.real_did = '';
        this.extension = '';

        this.#valNameIndex = 0;
        this.#_responsesTextQueue = '';
        this.#responsesTextQueue = {
            pull: () => {
                const queueText = this.#_responsesTextQueue;
                this.#_responsesTextQueue = '';
                return queueText;
            },
            push: (newResText) => {
                this._responsesTextQueue += `${newResText}&`;
            }
        };
    }

    get defaults () {
        return this.#defaults;
    }

    set defaults (newDefaults) {
        if (newDefaults.id_list_message?.prependToNextAction) {
            throw new Error('prependToNextAction is not supported as default');
        }

        if (typeof newDefaults.read?.timeout !== 'undefined' && !ms(newDefaults.read.timeout)) {
            throw new Error('timeout must be a valid ms liberty string/milliseconds number');
        }

        this.#defaults = {
            ...this.#defaults,
            ...newDefaults
        };
    }

    get values () {
        return this.#values;
    }

    set values (newValues) {
        throw new Error('call.values is read-only');
    }

    #logger (msg, color = 'blue') {
        if (!this.#defaults.common.printLog) return;
        console.log(colors[color](`[${this.callId}]: ${msg}`));
    }

    async read (messages, mode = 'tap', options = {}) {
        if (!Array.isArray(messages)) {
            throw new Error(`messages must be array, got ${typeof messages}`);
        }

        if (!messages.length) {
            throw new Error('messages must not be empty array');
        }

        if (messages.some((message) => typeof message !== 'object')) {
            throw new Error(`message must be object, one or more of the messages got type ${typeof messages}`);
        }

        if (messages.some((message) => typeof message.type !== 'string')) {
            throw new Error(`message type must be string, one or more of the messages got type ${typeof messages.type}`);
        }

        messages.forEach((message) => {
            if (message.type !== 'zmanim' && message.type !== 'music_on_hold') {
                if (typeof message.data !== 'string') throw new Error(`message (in type ${message.type}) data must be string, got ${typeof message.data}`);
            }
        });

        if (!['tap', 'stt', 'record'].includes(mode)) {
            throw new Error(`mode '${mode}' is Invalid. Valid modes are: tap, stt, record`);
        }

        let valName;
        let responseText;
        const sendResp = async () => {
            if (options.val_name) {
                valName = options.val_name;
            } else {
                this.#valNameIndex++;
                valName = `val_${this.#valNameIndex}`;
            }

            const messagesCombined = makeMessagesData(messages, options.removeInvalidChars ?? this.#defaults.read.removeInvalidChars);

            const readOptions = {
                ...this.#defaults.read[mode],
                timeout: this.#defaults.read.timeout,
                re_enter_if_exists: this.#defaults.read.re_enter_if_exists,
                removeInvalidChars: this.#defaults.read.removeInvalidChars,
                ...options,
                valName
            };

            if (mode === 'tap') {
                responseText = makeTapModeRead(messagesCombined, readOptions);
            } else if (mode === 'stt') {
                responseText = makeSttModeRead(messagesCombined, readOptions);
            } else if (mode === 'record') {
                responseText = makeRecordModeRead(messagesCombined, readOptions);
            }

            this.send(this.#responsesTextQueue.pull() + responseText);

            await this.blockRunningUntilNextRequest(options.timeout ?? this.#defaults.read.timeout);

            if (!this.#values[valName]) {
                await sendResp();
            }
        };

        await sendResp();

        const value = this.#values[valName];
        if (options.allow_none && String(value) === String(options.none_val)) {
            return options.none_val;
        }
        return value;
    }

    go_to_folder (target) {
        const responseTxt = `go_to_folder=${target}`;
        this.send(this.#responsesTextQueue.pull() + responseTxt);
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
    * @param {Msg[]} messages
    * @param {Object} options
    * @param {Boolean} options.prependToNextAction
    * @param {Boolean} options.removeInvalidChars
    */
    id_list_message (messages, options = {}) {
        if (!Array.isArray(messages)) {
            throw new Error(`messages must be array, got ${typeof messages}.\nmessages got: ${JSON.stringify(messages)}`);
        }

        if (!['object', 'undefined'].includes(typeof options)) {
            throw new Error(`if you pass options argument to id_list_message it must be object, but got ${typeof options} ('${options}')`);
        }

        const { prependToNextAction = false } = options;

        if (prependToNextAction && messages.some((message) => message?.type === 'go_to_folder')) {
            throw new Error('if you use go_to_folder message type in id_list_message you can\'t use prependToNextAction=true!');
        }

        // TODO:
        const goToFolderMessageIndex = messages.findIndex((message) => message?.type === 'go_to_folder');
        if (goToFolderMessageIndex !== -1 && goToFolderMessageIndex !== messages.length - 1) {
            throw new Error('go_to_folder message type must be the last message in id_list_message. No further messages can be threaded after this message type');
        }

        const responseTxt = 'id_list_message=' + makeMessagesData(messages, options.removeInvalidChars ?? this.#defaults.id_list_message.removeInvalidChars);

        if (prependToNextAction) {
            this.#responsesTextQueue.push(responseTxt);
        } else {
            if (this.res._headerSent) {
                this.#logger('Cannot send id_list_message after sending response (probably done from uncaughtErrorHandler due to error in asynchronous code after returning response)', 'red');
                return;
            }
            this.send(this.#responsesTextQueue.pull() + responseTxt + '&');
            throw new ExitError(this, {
                target: goToFolderMessageIndex !== -1 ? messages[goToFolderMessageIndex].data : `parent of /${this.extension}`,
                caller: goToFolderMessageIndex !== -1 ? 'go_to_folder' : 'id_list_message'
            });
        }
    }

    routing_yemot (number) {
        const responseTxt = `routing_yemot=${number}`;
        this.send(this.#responsesTextQueue.pull() + responseTxt);
        throw new ExitError(this, { target: `other system - ${number}`, caller: 'routing_yemot' });
    }

    send (data) {
        this.res.send(data);
    }

    setReqValues (req, res) {
        this.req = req;
        this.res = res;

        this.#values = shiftDuplicatedValues(req.method === 'POST' ? req.body : req.query);

        this.phone = this.#values.ApiPhone;
        this.callId = this.#values.ApiCallId;
        this.did = this.#values.ApiDID;
        this.real_did = this.#values.ApiRealDID;
        this.extension = this.#values.ApiExtension;

        const valuesToInject = Object.keys(this.#values).filter((key) => key.startsWith('Api'));
        for (const key of valuesToInject) {
            this[key] = this.#values[key];
        }
    }

    async blockRunningUntilNextRequest (timeout) {
        this.#logger(`🔒 fn running blocked - waiting to next request from yemot ${timeout ? `(timeout ${timeout === 'number' ? ms(timeout, { long: true }) : ms(ms(timeout), { long: true })} is defined)` : ''}`);
        return new Promise((resolve, reject) => {
            clearTimeout(this.#timeoutId);
            if (timeout) {
                const timeoutMilliseconds = typeof timeout === 'number' ? timeout : ms(timeout);
                this.#timeoutId = setTimeout(() => {
                    if (!this.res._headerSent) this.res.json({ message: 'timeout' });
                    reject(new TimeoutError(this, timeoutMilliseconds));
                }, timeoutMilliseconds);
            }
            this.#eventsEmitter.once(this.callId, (isHangup) => {
                clearTimeout(this.#timeoutId);
                this.#logger('🔓 fn running unblocked');
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
