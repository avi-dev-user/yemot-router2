const defaults = {
    common: {
        printLog: false
    },
    read: {
        // val_name is dynamic generated
        timeout: 0,
        re_enter_if_exists: false,
        removeInvalidChars: false,
        tap: {
            min_digits: '1',
            max_digits: null,
            sec_wait: 7,
            typing_playback_mode: 'No',
            block_asterisk_key: false,
            block_zero_key: false,
            replace_char: '',
            digits_allowed: null,
            amount_attempts: null,
            allow_empty: false,
            empty_val: 'None',
            block_change_keyboard: false
        },
        stt: {
            lang: '',
            block_typing: false,
            max_digits: null,
            quiet_max: null,
            max_length: null
        },
        record: {
            path: '',
            file_name: '',
            no_save_menu: false,
            save_on_hangup: true,
            append_to_existing_file: false,
            min_length: null,
            max_length: null
        }
    },
    id_list_message: {
        removeInvalidChars: false
        // prependToNextAction not supported as default
    }
};

module.exports = defaults;