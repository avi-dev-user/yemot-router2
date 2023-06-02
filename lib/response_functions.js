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
        Date: { min_digits: 8, max_digits: 8 },
        HebrewDate: { min_digits: 8, max_digits: 8 },
        Time: { min_digits: 4, max_digits: 4 },
        TeudatZehut: { min_digits: 8, max_digits: 9 },
        Phone: { min_digits: 9, max_digits: 10 }
    };

    if (options.typing_playback_mode && PRESETS_MIN_MAX[options.typing_playback_mode]) {
        options.min_digits = PRESETS_MIN_MAX[options.typing_playback_mode].min_digits;
        options.max_digits = PRESETS_MIN_MAX[options.typing_playback_mode].max_digits;
    }

    if (options.digits_allowed && !Array.isArray(options.digits_allowed)) {
        throw new Error(`digits_allowed must be array, got ${typeof options.digits_allowed} (${options.digits_allowed})`);
    }

    const tapOps = [
        options.valName, // val_name option
        options.re_enter_if_exists ? 'yes' : 'no',
        (options.max_digits || ''),
        (options.min_digits || '1'),
        (options.sec_wait || 7),
        (options.typing_playback_mode || 'No'),
        options.block_asterisk_key ? 'yes' : 'no',
        options.block_zero_key ? 'yes' : 'no',
        options.replace_char,
        options.digits_allowed ? options.digits_allowed.join('.') : '',
        (options.amount_attempts || ''),
        (options.allow_none ? 'Ok' : ''),
        (typeof options.none_val === 'undefined' ? 'None' : String(options.none_val)),
        (options.block_change_keyboard ? 'InsertLettersTypeChangeNo' : '')
    ];
    return `read=${messagesCombined}=${tapOps.join(',')}`;
};

/**
 * @param {String} messagesCombined
 * @param {Object} options
 * @returns {String} - the read text
 */
function makeSttModeRead (messagesCombined, options) {
    if (options.use_records_recognition_engine) {
        if (typeof options.block_typing !== 'undefined') {
            throw new Error('block_typing setting option is not available when use_records_recognition_engine is true - typing is always blocked in records recognition engine');
        }
    } else {
        if (options.quiet_max) {
            throw new Error('quiet_max option is only available when use_records_recognition_engine is true');
        } else if (options.length_max) {
            throw new Error('length_max option are only available when use_records_recognition_engine is true');
        }
    }

    const sttOps = [
        options.val_name,
        options.re_enter_if_exists ? 'yes' : 'no',
        'voice',
        options.lang,
        (options.block_typing ? 'no' : ''),
        (options.max_digits || ''),
        (options.quiet_max || ''),
        (options.length_max || '')
    ];
    return `read=${messagesCombined}=${sttOps.join(',')}`;
};

/**
 * @param {String} messagesCombined
 * @param {Object} options (record options)
 * @returns {String} - the read text
 */
function makeRecordModeRead (messagesCombined, options) {
    const recordOps = [
        options.val_name,
        options.re_enter_if_exists ? 'yes' : 'no',
        'record',
        options.path,
        options.file_name,
        (options.no_save_menu ? 'no' : ''),
        (options.save_on_hangup ? 'yes' : ''),
        (options.append_to_existing_file ? 'yes' : ''),
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

function makeMessagesData (messages, removeInvalidChars = false) {
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
        if (i > 1) res += '.';

        if (typeof value.type !== 'string') {
            throw new Error(`type must be a string, got ${typeof value.type}`);
        }
        if (!dataTypes[value.type]) {
            throw new Error(`${value.type} is not a valid type!\nValid types are: ${Object.keys(dataTypes).join(', ')}`);
        }

        res += dataTypes[value.type] + '-';

        switch (value.type) {
        case 'zmanim': {
            if (typeof value.data !== 'object') throw new Error('in "zmanim" type, data should be an object');
            let differenceSplitted;
            if (value.data.difference) {
                if (!/(-|\+)[YMDHmSs]\d+/.test(value.data.difference)) throw new Error('difference is invalid');
                differenceSplitted = value.data.difference.match(/(-|\+)(.+)/);
            }
            res += [
                value.data.time || 'T',
                value.data.zone || 'IL/Jerusalem',
                differenceSplitted ? differenceSplitted[1] : '',
                differenceSplitted ? differenceSplitted[2] : ''
            ].join(',');
            i++;
            break;
        }
        case 'music_on_hold': {
            if (typeof value.data !== 'object') throw new Error('in "music_on_hold" type, data should be an object');
            if (typeof value.data.musicName !== 'string') throw new Error('in "music_on_hold" type, data.musicName should be a string');
            if (typeof value.data.maxSec !== 'undefined' && !Number.isInteger(parseInt(value.data.maxSec))) throw new Error('in "music_on_hold" type, data.seconds should be a integer');
            if (value.data.maxSec) {
                res += `${value.data.musicName},${value.data.maxSec}`;
            } else {
                res += value.data.musicName;
            }
            i++;
            break;
        }
        case 'system_message': {
            const sysMsgId = String(value.data).replace('M', '').trim();
            if (!Number.isInteger(parseInt(sysMsgId))) {
                throw new Error(`'${value.data}' is not a valid system message id`);
            }
            if (sysMsgId.length !== 4) {
                throw new Error(`'${value.data}' is not a valid system message id - it should be 4 digits, got ${sysMsgId.length}!`);
            }
            res += sysMsgId;
            i++;
            break;
        }
        case 'date':
        case 'dateH':
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value.data)) {
                throw new Error(`'${value.data}' is not a valid date format. should be DD/MM/YYYY format`);
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

module.exports = {
    makeMessagesData,
    makeTapModeRead,
    makeSttModeRead,
    makeRecordModeRead
};