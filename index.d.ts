export declare function YemotRouter(options?: { timeout: Number; printLog: Boolean; uncaughtErrorHandler: function }): YemotRouter;

type CallHandler = (p: Call) => void;
interface YemotRouter {
    get: (path: String, handler: CallHandler) => void;
    post: (path: String, handler: CallHandler) => void;
    all: (path: String, handler: CallHandler) => void;
    deleteCallL: (callId: String) => void;
    defaults: {
        printLog?: Boolean;
        read?: {
            timeout?: Number;
            tap?: TapOps;
            stt?: SstOps;
            record?: RecordOps;
        };
        id_list_message?: idListMessageOptions;
    }
}

export type Call = {
    did: String;
    phone: String;
    real_did: String;
    callId: String;
    extension: String;

    read(messages: Msg[], mode?: 'tap' | 'stt' | 'record', options?: TapOps | RecordOps | SstOps): Promise<String | false>;
    go_to_folder(target: String): void;
    id_list_message(messages: Msg[], options?: idListMessageOptions): void;
    routing_yemot(number: String): void;
    restart_ext(): void;
    hangup(): void;
};

type Msg = {
    type: 'file' | 'text' | 'speech' | 'digits' | 'Number' | 'alpha' | 'zmanim' | 'go_to_folder' | 'system_message' | 'music_on_hold' | 'date' | 'dateH';
    data:
        | String
        | Number
        | {
              time?: String;
              zone?: String;
              difference?: String;
          };
    removeInvalidChars?: Boolean;
};

type GeneralOps = {
    val_name?: String;
    re_enter_if_exists?: Boolean;
    removeInvalidChars?: Boolean;
}

type TapOps = GeneralTapOps & {
    max_digits?: Number;
    min_digits?: Number;
    sec_wait?: Number;
    typing_playback_mode?: 'Number' | 'Digits' | 'File' | 'TTS' | 'Alpha' | 'No' | 'HebrewKeyboard' | 'EmailKeyboard' | 'EnglishKeyboard' | 'DigitsKeyboard' | 'TeudatZehut' | 'Price' | 'Time' | 'Phone' | 'No';
    block_asterisk_key?: Boolean;
    block_zero_key?: Boolean;
    replace_char?: String;
    digits_allowed?: Array<Number | String>;
    amount_attempts?: Number;
    allow_none?: Boolean;
    none_val: String;
    block_change_type_lang: Boolean;
};

type SstOps = GeneralTapOps & {
    lang: String;
    block_typing?: Boolean;
    max_digits?: Number;
    use_records_recognition_engine?: Boolean;
    quiet_max?: Number;
    length_max?: Number;
};

type RecordOps = GeneralTapOps & {
    path: String;
    file_name: String;
    no_save_menu: Boolean;
    save_on_hangup: Boolean;
    append_to_existing_file: Boolean;
    length_min?: Number;
    length_max?: Number;
};

type idListMessageOptions = {
    removeInvalidChars?: Boolean;
    prependToNextAction?: Boolean;
};

class ExitError extends Error {
    constructor(call, ...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);

        this.call = new Call();

        this.name = 'ExitError';
        this.date = new Date();
    }
}

class HangupError extends ExitError {
    constructor(...params) {
        this.name = 'HangupError';
    }
}

class TimeoutError extends ExitError {
    constructor(...params) {
        this.name = 'TimeoutError';
    }
}

class InputValidationError extends Error {
    constructor(message, ...params) {
        this.name = 'InputValidationError';
        this.message = message;
        this.isInputValidationError = true;
    }
}

export const errors = {
    ExitError,
    HangupError,
    TimeoutError,
    InputValidationError,
};
