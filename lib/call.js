const responseFunctions = new (require('./response_functions'))();
const { HangupError, TimeoutError, ExitError } = require('./errors');

function Call (callId, events, timeout) {
    this.did = '';
    this.phone = '';
    this.callId = '';
    this.real_did = '';
    this.extension = '';

    let urlValueIndex = 0;

    let request;
    let globalResponseTxt = '';

    const _this = this;

    this.read = async function read (massage, mode = 'tap', options = {}) {
        if (!Array.isArray(massage)) {
            throw new Error('data is not array!!');
        }

        let responseTxt, valReturn;

        const send = async () => {
            if (!options.val_name) urlValueIndex++;

            [responseTxt, valReturn] = responseFunctions.make_read_response(massage, mode, options, urlValueIndex);

            if (globalResponseTxt) {
                responseTxt = globalResponseTxt + responseTxt;
                globalResponseTxt = '';
            }

            await wait_to_request();

            this.send(responseTxt);

            await blockRunning(valReturn);

            if (!request.req.query[valReturn]) {
                await send();
            }
        };

        await send();

        if (request.req.query[valReturn]) {
            return request.req.query[valReturn];
        } else {
            return false;
        }
    };

    this.go_to_folder = function (folder) {
        let responseTxt = `go_to_folder=${folder}`;

        if (globalResponseTxt) {
            responseTxt = globalResponseTxt + responseTxt;
            globalResponseTxt = '';
        }

        this.send(responseTxt);

        throw new ExitError(_this);
    };

    this.restart_ext = function () {
        const folder = this.extension;
        let responseTxt = `go_to_folder=/${folder}`;

        if (globalResponseTxt) {
            responseTxt = globalResponseTxt + responseTxt;
            globalResponseTxt = '';
        }

        this.send(responseTxt);
    };

    /**
    * @param {[data]} massage
    */
    this.id_list_message = async function (massage, wait_to_more_action = false) {
        if (!Array.isArray(massage)) {
            throw new Error('data is not array!!');
        }

        const responseTxt = responseFunctions.make_id_list_message_response(massage);

        if (/(\.|=)g-.+/.test(responseTxt)) {
            console.log('No further actions can be threaded after go_to_folder!');
            wait_to_more_action = false;
        }

        if (!wait_to_more_action) {
            // אם הפונקציה נקראה, לפני שהמשתמש ביקש תגובה
            // סימן שזוהי הפעולה האחרונה
            await wait_to_request();

            this.send(responseTxt);

            throw new HangupError(_this);
        } else {
            globalResponseTxt = responseTxt;
        }
    };

    this.routing_yemot = function (phone) {
        let responseTxt = 'routing_yemot=' + phone;

        if (globalResponseTxt) {
            responseTxt = globalResponseTxt + responseTxt;
            globalResponseTxt = '';
        }

        this.send(responseTxt);
    };

    this.get_req_vals = function (req, res, next) {
        request = {
            req,
            res
        };

        Object.assign(this, request.req.query);

        this.did = this.ApiDID;
        this.phone = this.ApiPhone;
        this.callId = this.ApiCallId;
        this.real_did = this.ApiRealDID;
        this.extension = this.ApiExtension;

        this.query = request.req.query;
        this.params = request.req.params;
    };

    this.send = function send (data) {
        request.res.send(data);
    };

    const blockRunning = async function (valReturn) {
        return new Promise((resolve, reject) => {
            events.once(callId, (isHangup) => {
                console.log(valReturn, 'free');
                if (timeout) {
                    setTimeout(() => {
                        onTimeout(reject);
                    }, timeout);
                }
                if (isHangup) {
                    onHangup(reject);
                } else {
                    resolve(isHangup);
                }
            });
            console.log(valReturn, 'create block');
        });
    };

    async function wait_to_request () {
        if (request.res._headerSent) {
            await blockRunning();
        }
    }

    function onHangup (reject) {
        request.res.json({ message: 'hangup' });
        reject(new HangupError(_this));
    }

    function onTimeout (reject) {
        request.res.json({ message: 'timeout' });
        reject(new TimeoutError(_this));
    }

    return this;
}

module.exports = Call;
