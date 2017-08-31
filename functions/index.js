const admin = require('firebase-admin');
const auth = require('basic-auth');
const axios = require('axios');
const BxApi = require('./bx-api');
const CoinbaseApi = require('coinbase');
const functions = require('firebase-functions');

const config = functions.config();

const bx = new BxApi({
  apiKey: config.bx.api_key,
  apiSecret: config.bx.api_secret,
});
const coinbase = new CoinbaseApi.Client({
  apiKey: config.coinbase.api_key,
  apiSecret: config.coinbase.api_secret,
});

admin.initializeApp(config.firebase);

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
  let text = 'default text';
  const userId = orgInput.data.sender.id;
  const pageId = orgInput.data.recipient.id;
  const userRoutingOnDb = `/${pageId}/${userId}`;
  switch(action) {
    case 'getEth':
      coinbase.getBuyPrice({currencyPair: 'BTC-USD'}, (err, cbObj) => {
        Promise.all([
          bx.getEthToThb(),
        ]).then(values => {
          const bxObj = values[0];
          text = `The latest ETH prices are:\n`
            + `BX - ${values[0].last_price} thb/eth\n`
            + `Coinbase - ${cbObj.data.amount} usd/eth\n`;
          return res.json({
            speech: text,
            displayText: text,
            contextOut: contexts,
            source: 'AtCoinWebhook',
          });
        });
      });
      break;
    case 'getOmgToThb':
      bx.getOmgToThb().then((result) => {
        text = JSON.stringify(result, null, 2);
        return res.json({
          speech: text,
          displayText: text,
          contextOut: contexts,
          source: 'AtCoinWebhook',
        });
      });
      break;
    case 'getOmgToThbOnlyPrice':
      bx.getOmgToThbOnlyPrice().then((result) => {
        text = `The lastest price is ${result} Baht/OMG.`;
        return res.json({
          speech: text,
          displayText: text,
          contextOut: contexts,
          source: 'AtCoinWebhook',
        });
      });
      break;
    case 'subscribe':
      text = 'Successfully subscribed to news';
      admin.database().ref(`${userRoutingOnDb}/subscription`).set(true).then(snapshot => {
        return res.json({
          speech: text,
          displayText: text,
          contextOut: contexts,
          source: 'AtCoinWebhook',
        });
      });
      break;
    default:
      text = 'No matching action';
      return res.json({
        speech: text,
        displayText: text,
        contextOut: contexts,
        source: 'AtCoinWebhook',
      });
  }
});

exports.sendToFb = functions.https.onRequest((req, res) => {
  if (!config.facebook ||
      !config.facebook.access_token ||
      !config.facebook.page_id) {
    console.log('Config is not properly set');
    return res.send(401);
  }
  const pageId = config.facebook.page_id;
  const fbAccessToken = config.facebook.access_token;
  const url = `https://graph.facebook.com/v2.6/me/messages?access_token=${fbAccessToken}`;

  const IFTTTData = req.body;
  if (IFTTTData.access_token !== config.ifttt.access_token) {
    console.log('IFTTT token is incorrect!');
    return res.send(401);
  }

  // Get all subscribed users
  const tweet = IFTTTData.tweet;
  admin.database().ref(`${pageId}`).once('value').then((snapshot) => {
    const allUsers = snapshot.val();
    const replyObj = {
      recipient: { id: 'some_id' },
      message: { text: JSON.stringify(tweet, null, 2) },
    };
    // Create axios post for each user.
    const requests = Object.keys(allUsers).reduce((result, id) => {
      if (allUsers[id].subscription) {
        const newReply = Object.assign(replyObj, { recipient: { id } });
        return [...result, axios.post(url, newReply)];
      }
      return result;
    }, []);
    return axios.all(requests);
  })
  .then((allResponses) => {
    return res.send('success');
  });
});
