const admin = require('firebase-admin');
const auth = require('basic-auth');
const axios = require('axios');
const functions = require('firebase-functions');

const config = functions.config();

admin.initializeApp(config.firebase);

class BxApi {
  constructor() {}
  getOmgToThb() {
    const url = 'https://bx.in.th/api/';
    return axios.get(url)
      .then((res) => {
        return res.data['26'];
      });
  }
}

const bxApi = new BxApi();

exports.webhook = functions.https.onRequest((req, res) => {
  const credentials = auth(req);
  if (!config.apiai) {
    console.log('Config is not properly set');
    return res.send(401);
  }
  if (!credentials
    || credentials.name !== config.apiai.username
    || credentials.pass !== config.apiai.password) {
    console.log('Incorrect authentication header');
    console.log(credentials);
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.send(401);
  }

  const orgInput = req.body.originalRequest;
  const apiAiInput = req.body.result;
  const action = apiAiInput.action;
  const contexts = apiAiInput.contexts;

  bxApi.getOmgToThb().then((result) => {
    const text = JSON.stringify(result, null, 2);
    return res.json({
      speech: text,
      displayText: text,
      contextOut: contexts,
      source: 'AtCoinWebhook',
    });
  });
});
