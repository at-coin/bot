const admin = require('firebase-admin');
const auth = require('basic-auth');
const functions = require('firebase-functions');

admin.initializeApp(functions.config().firebase);

exports.webhook = functions.https.onRequest((req, res) => {
  const credentials = auth(req);
  if (!credentials || credentials.name !== 'username' || credentials.pass !== 'password') {
    console.log('Incorrect authentication header');
    console.log(credentials);
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.send(401);
  }

  const orgInput = req.body.originalRequest;
  const apiAiInput = req.body.result;
  const action = apiAiInput.action;
  const contexts = apiAiInput.contexts;
  const text = 'from webhook';
  return res.json({
    speech: text,
    displayText: text,
    contextOut: contexts,
    source: 'AtCoinWebhook',
  });
});
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
