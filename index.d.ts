export declare function YemotRouter(options?: { timeout: number, printLog: boolean, uncaughtErrorsHandler: function }): YemotRouter;

interface YemotRouter {
    get: (path: string, handler: Handler) => void;
    post: (path: string, handler: Handler) => void;
    all: (path: string, handler: Handler) => void;
}
export type Call = {
    did: string;
    phone: string;
    real_did: string;
    callId: string;
    extension: string;
    query: object;

    read(messages: [msg_data], mode?: mode, options?: read_options): Promise<String | false>;

    go_to_folder(folder: string): void;

    id_list_message(data: [msg_data], wait_to_more_action: boolean): void;

    routing_yemot(phone: string): void;

    restart_ext(): void;
};

type Handler = (p: Call) => void;

type msg_data = [{ type: msg_data_type; data: string }];

type msg_data_type = 'file' | 'text' | 'speech' | 'digits' | 'number' | 'alpha' | 'zmanim' | 'go_to_folder' | 'system_message' | 'music_on_hold' | 'date' | 'dateH';

type mode = 'tap' | 'stt' | 'record';

type read_options = {
    val_name: string;
    re_enter_if_exists: boolean;
    max: number;
    min: number;
    sec_wait: number;
    play_ok_mode: play_ok_mode;
    block_asterisk: boolean;
    block_zero: boolean;
    replace_char: string;
    digits_allowed: (number | string)[];
    amount_attempts: number;
    read_none: boolean;
    read_none_var: string;
    block_change_type_lang: boolean;

    lang: string;
    allow_typing: boolean;
    max_digits?: number;
    use_records_engine: boolean;
    quiet_max?: number;
    length_max?: number;

    path: string;
    file_name: string;
    record_ok: boolean;
    record_hangup: boolean;
    record_attach: boolean;
};

type play_ok_mode = 'Number' | 'Digits' | 'File' | 'TTS' | 'Alpha' | 'No' | 'HebrewKeyboard' | 'EmailKeyboard' | 'EnglishKeyboard' | 'DigitsKeyboard' | 'TeudatZehut' | 'Price' | 'Time' | 'Phone' | 'No';

export const errors = {
    ExitError,
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
