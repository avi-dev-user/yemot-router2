const express = require('express');
const app = express();
const { YemotRouter } = require('./index');

const router = YemotRouter({
    printLog: true,
    uncaughtErrorsHandler: (error, call) => {
        console.log(`Uncaught error in ${call.req.path} from ${call.phone}. error stack: ${error.stack}`);
        // do something with the error - like send email to developer, print details log, etc.
        return call.id_list_message([{ type: 'text', data: 'אירעה שגיאה' }]); // play nice error message to the caller
    }
});

router.get('/', async (call) => {
    // לא ניתן להתקדם ללא הקשת 10 וסולמית
    await call.read([{ type: 'text', data: 'היי, תקיש 10' }], 'tap', {
        max_digits: 2,
        min_digits: 2,
        digits_allowed: ['10']
    });

    const nameMessages = [{ type: 'text', data: 'שלום, אנא הקש את שמך המלא' }];
    const name = await call.read(nameMessages, 'tap', { typing_playback_mode: 'HebrewKeyboard' });
    console.log(name);

    const addressFilePath = await call.read(
        [
            { type: 'text', data: 'שלום ' + name },
            { type: 'text', data: 'אנא הקלט את הרחוב בו אתה גר' }
        ], 'record',
        { removeInvalidChars: true }
    );
    console.log(addressFilePath);

    // קטע זה משתמש בזיהוי דיבור ודורש יחידות במערכת
    const text = await call.read([{ type: 'text', data: 'אנא אמור בקצרה את ההודעה שברצונך להשאיר' }], 'stt');
    console.log(text);

    // לאחר השמעת ההודעה יוצא אוטומטית מהשלוחה
    // לשרשור פעולות לאחר השמעת ההודעה יש להגדיר prependToNextAction: true, ראה בREADME
    return call.id_list_message([{
        type: 'system_messages',
        data: 'M1399' // תגובתך התקבלה בהצלחה
    }]);
});

// this must if you want to use post requests (api_url_post=yes)
app.use(express.urlencoded({ extended: true }));

app.use('/', router);

const port = 3000;
app.listen(port, () => {
    console.log(`example yemot-router2 runing on port ${port}`);
});
