const { InputValidationError } = require('./errors');
const colors = require('colors');

const dataTypes = {
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

/**
 * @param {String} messagesCombined
 * @param {Object} options
 * @returns {String} - the read text
 */
function makeTapModeRead (messagesCombined, options) {
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

    const tapOps = [
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
    return `read=${messagesCombined}=${tapOps.join(',')}`;
};

/**
 * @param {String} messagesCombined
 * @param {Object} options
 * @returns {String} - the read text
 */
function makeSttModeRead (messagesCombined, options) {
    if (options.use_records_engine) {
        if (options.allow_typing) {
            throw new InputValidationError('allow_typing option is not available when use_records_engine is true');
        }
    } else {
        if (options.quiet_max) {
            throw new InputValidationError('quiet_max option is only available when use_records_engine is true');
        } else if (options.length_max) {
            throw new InputValidationError('length_max option are only available when use_records_engine is true');
        }
    }

    const sttOps = [
        options.val_name,
        (options.re_enter_if_exists || false) ? 'yes' : 'no',
        'voice',
        (options.lang || ''),
        (options.allow_typing || false) ? 'yes' : 'no',
        (options.max_digits || ''),
        (options.quiet_max || ''),
        (options.length_max || '')
    ];
    return `read=${messagesCombined}=${sttOps.join(',')}`;
};

/**
 * @param {String} messagesCombined
 * @param {Object} options
 * @returns {String} - the read text
 */
function makeRecordModeRead (messagesCombined, options) {
    if (options.lenght_min) {
        console.warn('[warning] lenght_min option is deprecated and will be removed in the future, use length_min instead');
        options.length_min = options.lenght_min;
    }
    if (options.lenght_max) {
        console.warn('[warning] lenght_max option is deprecated and will be removed in the future, use length_max instead');
        options.length_max = options.lenght_max;
    }
    const recordOps = [
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
    return `read=${messagesCombined}=${recordOps.join(',')}`;
};

function validateChars (text) {
    const invalidCharsRgx = /[.\-"'&|]/g;
    const invalidCharsMatched = text.match(invalidCharsRgx);
    if (invalidCharsMatched) {
        throw new InputValidationError(`message '${text}' has invalid characters for yemot: ${colors.red(invalidCharsMatched.join(', '))}`);
    }
}

function removeInvalidCharsFromText (text) {
    const invalidCharsRgx = /[.\-"'&|]/g;
    const invalidCharsMatched = text.match(invalidCharsRgx);
    if (invalidCharsMatched) {
        console.warn(`Invalid characters for yemot have been removed from the text: ${colors.red(invalidCharsMatched.join(', '))};\noriginal text: ${text}`);
    }
    return text.replaceAll(invalidCharsRgx, '');
}

function makeReadData (messages, removeInvalidChars = false) {
    for (const msg of messages) {
        if (typeof msg.data !== 'string') continue;
        if (msg.type === 'text' && (msg.removeInvalidChars || removeInvalidChars)) {
            msg.data = removeInvalidCharsFromText(msg.data);
        } else {
            validateChars(msg.data);
        }
    }

    let res = '';
    let i = 1;
    for (const value of messages) {
        res += i > 1 ? '.' : '';
        if (typeof value.type !== 'string') {
            throw new InputValidationError(`type must be a string, got ${typeof value.type}`);
        }
        if (!dataTypes[value.type]) {
            throw new InputValidationError(`${value.type} is not a valid type!\nValid types are: ${Object.keys(dataTypes).join(', ')}`);
        }

        res += dataTypes[value.type] + '-';

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
                throw new InputValidationError(`'${value.data}' is not a valid system message id`);
            }
            if (msgId.length !== 4) {
                throw new InputValidationError(`'${value.data}' is not a valid system message id - it should be 4 digits, got ${msgId.length}!`);
            }
            res += msgId;
            break;
        }
        case 'date':
        case 'dateH':
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value.data)) {
                throw new InputValidationError(`'${value.data}' is not a valid date format. should be DD/MM/YYYY format`);
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

/**
 * @param {Array} messages
 * @param {String} mode - tap, stt, record
 * @param {Object} options
 * @param {Number} valIndex
 * @returns {Object} - { responseText, valName }
 * @throws {InputValidationError} - if mode is invalid
 * @returns {String} responseText
 * @returns {String} valName
**/
function makeReadResponse (messages, mode, options, valIndex = 1) {
    if (!options.val_name) {
        options.val_name = `val_${valIndex}`;
    }

    let responseText;
    const messagesCombined = makeReadData(messages, options.removeInvalidChars);

    switch (mode) {
    case 'tap':
        responseText = makeTapModeRead(messagesCombined, options);
        break;
    case 'stt':
        responseText = makeSttModeRead(messagesCombined, options);
        break;
    case 'record':
        responseText = makeRecordModeRead(messagesCombined, options);
        break;
    default:
        throw new InputValidationError(`mode '${mode}' is Invalid. Valid modes are: tap, stt, record`);
    }

    return { responseText, valName: options.val_name };
};

function makeIdListMessageResponse (messages) {
    return 'id_list_message=' + makeReadData(messages) + '&';
};

module.exports = {
    makeReadResponse,
    makeIdListMessageResponse
};