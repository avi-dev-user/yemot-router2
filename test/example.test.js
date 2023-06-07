const request = require('supertest');
const { app: exampleApp, router } = require('../example');
const crypto = require('crypto');
const qs = require('qs');

describe('example.js file', () => {
    const randomPort = Math.floor(Math.random() * 10000) + 10000;
    let server;

    beforeAll(async () => {
        server = await exampleApp.listen(randomPort);
        console.log(`server listening on port ${randomPort}`);
    });

    afterAll(async () => {
        await server.close();
    });

    it('should return 200 and not valid yemot request message', async () => {
        const response = await request(`http://localhost:${randomPort}`).get('/');
        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('the request is not valid yemot request');
    });

    const callId = crypto.randomBytes(20).toString('hex');
    const YFCallId = crypto.randomBytes(20).toString('hex');
    const query = {
        ApiCallId: callId,
        ApiYFCallId: YFCallId,
        ApiDID: '0772222770',
        ApiRealDID: '0772222770',
        ApiPhone: '0527000000',
        ApiExtension: '',
        ApiTime: new Date().getTime().toString()
    };

    it('should return valid read response', async () => {
        const response = await request(`http://localhost:${randomPort}`).get(`/?${qs.stringify(query)}`);
        expect(response.text).toBe('read=t-היי, תקיש 10=val_1,no,2,2,7,No,no,no,,10,,,None,');
    });

    it('should call added to active calls', () => {
        expect(router.activeCalls[callId].ApiCallId).toBe(query.ApiCallId);
    });

    it('should all query params added to call.values', () => {
        expect(router.activeCalls[callId].values).toEqual(query);
    });

    it('should return cannot POST / when use router.get', async () => {
        const response = await request(`http://localhost:${randomPort}`).post('/');
        expect(response.statusCode).toBe(404);
        expect(response.error.message).toBe('cannot POST / (404)');
        expect(response.text).toMatch('Cannot POST /');
    });

    query.val_1 = '10';
    it('should continue to next read', async () => {
        const response = await request(`http://localhost:${randomPort}`).get(`/?${qs.stringify(query)}`);
        expect(response.text).toBe('read=t-שלום, אנא הקש את שמך המלא=val_2,no,,1,7,HebrewKeyboard,no,no,,,,,None,');
    });

    it('should return valid hangup response and remove call from active calls', async () => {
        query.ApiHangup = '';
        query.hangup = 'yes';

        const response = await request(`http://localhost:${randomPort}`).get(`/?${qs.stringify(query)}`);
        expect(response.body.message).toBe('hangup');
        expect(router.activeCalls[callId]).toBeUndefined();
    });
});
