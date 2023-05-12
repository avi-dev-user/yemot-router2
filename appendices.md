# נספחים

## הרצת קוד לאחר החזרת תשובה למחייג

**⚠️ שימו לב - קטע זה מורכב מעט להבנה, ונצרך רק אם אתם מעוניינים להחזיר תשובה למחייב ולתת לו לצאת מהשלוחה (id_list_message), ולאחר מכן להריץ קוד "כבד", ולא נצרכת אם רוצים לתת למאזין להמתין לאישור ביצוע הפעולה (באמצעות read).**

בעת החזרת תשובה שאינה read ולא גורמת לשרת של ימות לחזור לראוטר - id_list_message או go_to_folder,
נזרקת שגיאה על ידי הספריה - שתופסת אותה בחזרה ברמה יותר גבוהה, וכך ריצת הפונקציה נהרגת כדי לחסוך בזיכרון
וכן לנקות את השיחה מהactiveCalls - כדי שבכניסה חוזרת לשלוחה הפונקציה תרוץ מההתחלה ולא תמשיך.

לכן אם מנסים להחזיר תשובה למשתמש ולאחר מכן להריץ את הקוד ה"כבד" כמו שניתן לעשות בשרת nodejs + express, לדוגמה:
```js
function runBigJob(req, res) {
    res.status(202).send('ok, we got your request, we will send you an email when the job is done')
    doBigJob()
}
```
או במקרה של הראוטר - קוד (**שגוי**) כזה:
```js
async function runBigJob(call) {
    call.id_list_message([{
        type: 'text',
        data: 'בסדר, בקשתך תטופל בהקדם'
    }])
    await doBigJob()
}
```
קוד כזה לא יעבוד כיוון שהקריאה ל`call.id_list_messsage` זורקת שגיאה שהורגת את ריצת הפונקציה, ולכן הקוד שלאחריה לא ירוץ.

כדי להריץ קוד לאחר החזרת התשובה, יש לתפוס את השגיאה שנזרקת (במקרה שהיא שגיאת `ExitError` פנימית כנ"ל):

```js
const { ExitError } = require('yemot-router2');
async function runBigJob (call) {
    try {
        call.id_list_message([{
            type: 'text',
            data: 'בסדר, בקשתך תטופל בהקדם'
        }]);
    } catch (error) {
        if (error.isExitError) return;
        throw error;
    };
    await doBigJob();
}
```

אופציה נוספת היא להריץ את הקוד בצורה מנותקת מהפונקציה, כלומר קריאה לקוד ה"כבד" בתוך פונקציית חץ **לפני** החזרת התשובה.

### מחיקה ידנית של השיחה מה`activeCalls`

אין צורך לזרוק ידנית את `ExitError` כדי למחוק את השיחה מהactiveCalls, כיוון שהיא נמחקת אוטומטית על ידי הספריה בסיום הריצה של הפונקציה.<br>
עם זאת, באם הקוד הנוסף המורץ אמור לקחת זמן, מומלץ לנקות ידנית באופן מיידי (מייד לאחר החזרת התשובה בid_list_message) את השיחה מהactiveCalls - אחרת לא יהיה ניתן להיכנס לשלוחה עד לסיום ביצוע הפעולה הכבדה:

```js
const router = YemotRouter({ printLog: true });
router.get('/', async (call) => {
    try {
        call.id_list_message([{
            type: 'text',
            data: 'בסדר, בקשתך תטופל בהקדם'
        }]);
    } catch (error) {
        if (error.isExitError) return;
        throw error;
    };
    router.deleteCall(call.callId);
    await doBigJob();
});
```
