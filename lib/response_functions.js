const { InputValidationError } = require('./errors');
const colors = require('colors');

const dataType = {
    file: 'f',
    text: 't',
    speech: 's',
    digits: 'd',
    number: 'n',
    alpha: 'a',
    zmanim: 'z',
    go_to_folder: 'g',
    system_message: 'm',
    music_on_hold: 'h',
    date: 'date',
    dateH: 'dateH'
};

const responseFunctions = function () {
    const makeTapModeRequest = function (dataStr, options) {
        const PRESETS_MIN_MAX = { // from yemot docs https://f2.freeivr.co.il/post/77520
            Date: { min: 8, max: 8 },
            HebrewDate: { min: 8, max: 8 },
            Time: { min: 4, max: 4 },
            TeudatZehut: { min: 8, max: 9 },
            Phone: { min: 9, max: 10 }
        };

        if (options.play_ok_mode && PRESETS_MIN_MAX[options.play_ok_mode]) {
            options.min = PRESETS_MIN_MAX[options.play_ok_mode].min;
            options.max = PRESETS_MIN_MAX[options.play_ok_mode].max;
        }

        const values = [
            options.val_name,
            (options.re_enter_if_exists || false) ? 'yes' : 'no',
            (options.max || '*'),
            (options.min || '1'),
            (options.sec_wait || 7),
            (options.play_ok_mode || 'No'),
            (options.block_asterisk || false) ? 'yes' : 'no',
            (options.block_zero || false) ? 'yes' : 'no',
            (options.replace_char || ''),
            options.digits_allowed ? options.digits_allowed.join('.') : '',
            (options.amount_attempts || ''),
            (options.read_none || false) ? 'Ok' : 'no',
            (options.read_none_var || ''),
            (options.block_change_type_lang ? 'InsertLettersTypeChangeNo' : '')
        ];
        return `read=${dataStr}=${values.join(',')}`;
    };

    const makeSttModeRequest = function (dataStr, options) {
        const values = [
            options.val_name,
            (options.re_enter_if_exists || false) ? 'yes' : 'no',
            'voice',
            (options.lang || ''),
            (options.allow_typing || false) ? 'yes' : 'no'
        ];
        return `read=${dataStr}=${values.join(',')}`;
    };

    const makeRecordModeRequest = function (dataStr, options) {
        if (options.lenght_min) {
            console.warn('[warning] lenght_min option is deprecated and will be removed in the future, use length_min instead');
            options.length_min = options.lenght_min;
        }
        if (options.lenght_max) {
            console.warn('[warning] lenght_max option is deprecated and will be removed in the future, use length_max instead');
            options.length_max = options.lenght_max;
        }
        const values = [
            options.val_name,
            (options.re_enter_if_exists || false) ? 'yes' : 'no',
            'record',
            (options.path || ''),
            (options.file_name || ''),
            (options.record_ok === false) ? 'no' : 'yes',
            (options.record_hangup || false) ? 'yes' : 'no',
            (options.record_attach || false) ? 'yes' : 'no',
            (options.length_min || ''),
            (options.length_max || '')
        ];
        return `read=${dataStr}=${values.join(',')}`;
    };

    function validateText (messages) {
        const invalidCharsRgx = /[.\-"'&|]/g;
        for (const msg of messages) {
            if (typeof msg.data !== 'string') return;
            const invalidCharsMatched = msg.data.match(invalidCharsRgx);
            if (invalidCharsMatched) {
                throw new InputValidationError(`'${msg.data}' has invalid characters for yemot: ${colors.red(invalidCharsMatched.join(', '))}`);
            }
        }
    }

    const makeReadData = function (data) {
        validateText(data);
        let res = '';
        let i = 1;
        for (const value of data) {
            res += i > 1 ? '.' : '';
            if (typeof value.type !== 'string') {
                throw new InputValidationError(`in ${JSON.stringify(value)} type is not a string, it is ${typeof value.type}`);
            }
            if (!dataType[value.type]) {
                throw new InputValidationError(`${value.type} is not a valid type!\nValid types are: ${Object.keys(dataType).join(', ')}`);
            }

            res += dataType[value.type] + '-';

            switch (value.type) {
            case 'zmanim': {
                if (typeof value.data !== 'object') throw new InputValidationError('in "zmanim" type, data should be an object');
                let differenceSplitted;
                if (value.data.difference) {
                    if (!/(-|\+)[YMDHmSs]\d+/.test(value.data.difference)) throw new InputValidationError('difference is invalid');
                    differenceSplitted = value.data.difference.match(/(-|\+)(.+)/);
                }
                res += [
                    value.data.time || 'T',
                    value.data.zone || 'IL/Jerusalem',
                    differenceSplitted ? differenceSplitted[1] : '',
                    differenceSplitted ? differenceSplitted[2] : ''
                ].join(',');
                break;
            }
            case 'system_message': {
                const msgId = String(value.data).replace('M', '').trim();
                if (!Number.isInteger(parseInt(msgId))) {
                    throw new InputValidationError(`${value.data} is not a valid system message id!`);
                }
                if (msgId.length !== 4) {
                    throw new InputValidationError(`${value.data} is not a valid system message id - it should be 4 digits, got ${msgId.length}!`);
                }
                res += msgId;
                break;
            }
            case 'date':
            case 'dateH':
                if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value.data)) {
                    throw new InputValidationError(`${value.data} is not a valid date format. should be DD/MM/YYYY`);
                }
                res += value.data;
                i++;
                break;
            default:
                res += value.data;
                i++;
            }
            if (value.type === 'go_to_folder') break;
        }
        return res;
    };

    this.make_read_response = function (messages, mode, options, valueIndex = 1) {
        if (!options.val_name) {
            options.val_name = 'val_' + valueIndex;
        }

        const dataStr = makeReadData(messages);
        let res;

        switch (mode) {
        case 'tap':
            res = makeTapModeRequest(dataStr, options);
            break;
        case 'stt':
            res = makeSttModeRequest(dataStr, options);
            break;
        case 'record':
            res = makeRecordModeRequest(dataStr, options);
            break;
        default:
            throw new InputValidationError('mode parameter is Invalid. Valid modes are: tap, stt, record');
        }

        return { responseText: res, valReturn: options.val_name };
    };

    this.make_id_list_message_response = function (data) {
        return 'id_list_message=' + makeReadData(data) + '&';
    };
};

module.exports = responseFunctions;