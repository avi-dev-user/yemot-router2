const express = require('express');
const app = express();
const { YemotRouter, HangupError } = require('./index');

const router = YemotRouter({
    printLog: true,
    uncaughtErrorsHandler: (error, call) => {
        console.log(`Uncaught error in ${call.req.path} from ${call.phone}. error stack: ${error.stack}`);
        // do something with the error - like send email to developer, print details log, etc.
        return call.id_list_message([{ type: 'text', data: 'אירעה שגיאה' }]); // play nice error message to the caller
    }
});

router.get('/', async (call) => {
    let messages = [{ type: 'text', data: 'היי, תקיש 10' }];
    let r = await call.read(messages)
        .catch(error => {
            if (error instanceof HangupError) {
                // do something with the event, and then throw the error again for stop the run
            }
            throw error; // throw the error again if it's not a HangupError
        });

    messages = [{ type: 'text', data: 'שלום, אנא הקש את שמך המלא' }];
    r = await call.read(messages, 'tap', { typing_playback_mode: 'HebrewKeyboard' })
        .catch(error => {
            if (error.name === 'HangupError') { console.log(error.call.phone, 'hangup'); }
            throw error;
        });

    console.log(r);

    messages = [
        { type: 'text', data: 'שלום ' + r },
        { type: 'text', data: 'אנא הקלט את הרחוב בו אתה גר' }
    ];
    r = await call.read(messages, 'record');

    console.log(r);

    messages = [{ type: 'text', data: 'אנא אמור את שם הרחוב בו אתה גר' }];
    r = await call.read(messages, 'stt');

    console.log(r);

    messages = [{ type: 'text', data: 'אמרת' }];
    r = await call.id_list_message(messages, { prependToNextAction: true });

    console.log(r);

    call.go_to_folder('/1');
});

app.use(express.urlencoded({ extended: true })); // A must if you want to use post requests (api_url_post=yes)

app.use('/', router);

const port = 3000;
app.listen(port, () => {
    console.log('listen in port', port);
});
