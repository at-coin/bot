const admin = require('firebase-admin');
const auth = require('basic-auth');
const axios = require('axios');
const functions = require('firebase-functions');
const fx = require('money');
const { stripIndent, stripIndents } = require('common-tags');
const tokenList = require('./ethTokens.json');
const utils = require('./utils');

const config = require('./config.json');

const BxApi = require('./bx-api');
const CoinbaseApi = require('./coinbase-api');
const MyWalletApi = require('./mywallet-api');

const bx = new BxApi(config.bx.api_key, config.bx.api_secret);
const coinbase = new CoinbaseApi(config.coinbase.api_key, config.coinbase.api_secret);
const mywallet = new MyWalletApi(config.mywallet.account, config.mywallet.api_key);

admin.initializeApp(functions.config().firebase);

// Convenient function to get exchange rate.
const getExchangeRates = () => axios.get('http://api.fixer.io/latest?base=THB').then((res) => {
  fx.base = res.data.base;
  fx.rates = res.data.rates;
  const SGD = fx(1).from('SGD').to('THB');
  const USD = fx(1).from('USD').to('THB');
  return { SGD, USD };
});

// Get bitfinex ticker
const getBitfinexTickers = () => axios.get('https://api.bitfinex.com/v2/tickers?symbols=tBTCUSD,tETHUSD,tLTCUSD,tOMGUSD')
  .then((res) => {
    const { data } = res;
    return {
      BTC: {
        lastPrice: data[0][7],
      },
      ETH: {
        lastPrice: data[1][7],
      },
      LTC: {
        lastPrice: data[2][7],
      },
      OMG: {
        lastPrice: data[3][7],
      },
    };
  });

// Facebook command list as a quick reply
/* eslint-disable camelcase */
const quick_replies = ['omg', 'omg profit', 'eth', 'btc'].map(text => ({
  content_type: 'text',
  title: text,
  payload: text,
}));

const createFbResponse = (text, contexts) => ({
  speech: text,
  displayText: text,
  data: { facebook: { text, quick_replies } },
  contextOut: contexts,
  source: 'AtCoinWebhook',
});
/* eslint-enable camelcase */

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
  const { action, parameters, contexts } = apiAiInput;
  const userId = orgInput.data.sender.id;
  const pageId = orgInput.data.recipient.id;
  const userRoutingOnDb = `/${pageId}/${userId}`;
  let text = '';
  switch (action) {
    case 'getExchangeRates':
      getExchangeRates().then((rates) => {
        text = stripIndent`
          USD: ${rates.USD}
          SGD: ${rates.SGD}`;
        return res.json(createFbResponse(text, contexts));
      });
      break;
    case 'getTokenList':
      console.log(tokenList);
      text = 'success';
      res.json(createFbResponse(text, contexts));
      break;
    case 'getAllBalances':
      Promise.all([
        bx.getBalances(),
        coinbase.getBalances(),
        mywallet.getBalances(),
      ]).then((values) => {
        function balanceTmpl(balances) {
          let result = '';
          Object.keys(balances).forEach((key) => {
            const amount = parseFloat(balances[key]);
            if (amount !== 0) {
              result += `${key} : ${amount}\n`;
            }
          });
          return result;
        }
        text = stripIndents`
          [BX]
          ${balanceTmpl(values[0])}
          [Coinbase]
          ${balanceTmpl(values[1])}
          [MyWallet]
          ${balanceTmpl(values[2])}`;
        return res.json(createFbResponse(text, contexts));
      });
      break;
    case 'getAllProfits':
      Promise.all([
        bx.getBalances(),
        coinbase.getBalances(),
        mywallet.getBalances(),
        bx.getTransactionsSummary(),
        coinbase.getTransactionsSummary(),
        getExchangeRates(),
        bx.getBuyPrice(),
      ]).then((values) => {
        const wantedCoin = parameters.currency.toUpperCase();
        const bxBal = values[0];
        const cbBal = values[1];
        const walletBal = values[2];
        const bxTrans = values[3];
        const cbTrans = values[4];
        const rates = values[5];
        const buyPrices = values[6];
        // Sum up balances;
        let balances = {};
        utils.addUpBalances(bxBal, balances);
        utils.addUpBalances(cbBal, balances);
        utils.addUpBalances(walletBal, balances);
        const bxSum = utils.summarizeExchangeSiteTransactions(bxTrans);
        const cbSum = utils.summarizeExchangeSiteTransactions(cbTrans);
        let buys = {};
        utils.addUpType(bxSum, buys, 'buy', rates);
        utils.addUpType(cbSum, buys, 'buy', rates);
        let sells = {};
        utils.addUpType(bxSum, sells, 'sell', rates);
        utils.addUpType(cbSum, sells, 'sell', rates);
        const profits = utils.calProfits(balances, buys, sells, buyPrices);
        text = JSON.stringify(profits[wantedCoin]);
        text = text.replace(/[{}"]/g, '').replace(/,/g, '\n');
        return res.json(createFbResponse(text, contexts));
      });
      break;
    case 'getAllTransactions':
      Promise.all([
        bx.getTransactionsSummary(),
        coinbase.getTransactionsSummary(),
        getExchangeRates(),
      ]).then((values) => {
        const bxTrans = values[0];
        const cbTrans = values[1];
        const rates = values[2];
        const bxSum = utils.summarizeExchangeSiteTransactions(bxTrans);
        console.log(bxSum);
        const cbSum = utils.summarizeExchangeSiteTransactions(cbTrans);
        console.log(cbSum);
        /*admin.database().ref(`${userRoutingOnDb}/CoinbaseTransactions`)
          .set(values[1])
          .then(() => res.json(createFbResponse(text, contexts)));*/
        text = stripIndents`
          ${utils.summaryTmpl('Coinbase', cbSum)}`;
        return res.json(createFbResponse(text, contexts));
      });
      break;
    case 'getCoinbaseTransaction':
      coinbase.getAccountsWithTransactions()
        .then((result) => {
          console.log(result);
          text = 'Successfully get accounts with transaction data';
          return res.json(createFbResponse(text, contexts));
        });
      break;
    case 'getBxTransaction':
      bx.getAllTransactions()
        .then((result) => {
          console.log(result);
          text = 'Successfully get transaction data';
          return res.json(createFbResponse(text, contexts));
        });
      break;
    case 'getBtc':
      Promise.all([
        bx.getBuyPrice('THB-BTC'),
        getExchangeRates(),
        getBitfinexTickers(),
        coinbase.getBuyPrice('BTC-SGD'),
      ]).then((values) => {
        const bxObj = values[0];
        const rates = values[1];
        const bfObj = values[2];
        const cbObj = values[3];
        text = stripIndent`
          The latest BTC prices are:
          [THB]
          Bx - ${bxObj.last_price}
          Coinbase - ${cbObj.data.amount * rates.SGD}
          Bitfinex - ${bfObj.BTC.lastPrice * rates.USD}
          [SGD]
          Coinbase - ${cbObj.data.amount}
          [USD]
          Bitfinex - ${bfObj.BTC.lastPrice}`;
        return res.json(createFbResponse(text, contexts));
      });
      break;
    case 'getEth':
      Promise.all([
        bx.getBuyPrice('THB-ETH'),
        getExchangeRates(),
        getBitfinexTickers(),
        coinbase.getBuyPrice('ETH-SGD'),
      ]).then((values) => {
        const bxObj = values[0];
        const rates = values[1];
        const bfObj = values[2];
        const cbObj = values[3];
        text = stripIndent`
          The latest ETH prices are:
          [THB]
          Bx - ${bxObj.last_price}
          Coinbase - ${cbObj.data.amount * rates.SGD}
          Bitfinex - ${bfObj.ETH.lastPrice * rates.USD}
          [SGD]
          Coinbase - ${cbObj.data.amount}
          [USD]
          Bitfinex - ${bfObj.ETH.lastPrice}`;
        return res.json(createFbResponse(text, contexts));
      });
      break;
    case 'getOmg':
      Promise.all([
        bx.getBuyPrice('THB-OMG'),
        getExchangeRates(),
        getBitfinexTickers(),
      ]).then((values) => {
        const bxObj = values[0];
        const rates = values[1];
        const bfObj = values[2];
        text = stripIndent`
          The latest OMG prices are:
          [THB]
          Bx - ${bxObj.last_price}
          Bitfinex - ${bfObj.OMG.lastPrice * rates.USD}
          [USD]
          Bitfinex - ${bfObj.OMG.lastPrice}`;
        return res.json(createFbResponse(text, contexts));
      });
      break;
    case 'subscribe':
      text = 'Successfully subscribed to news';
      admin.database().ref(`${userRoutingOnDb}/subscription`).set(true)
        .then(() => res.json(createFbResponse(text, contexts)));
      break;
    case 'help':
      text = 'TODO: add help text';
      res.json(createFbResponse(text, contexts));
      break;
    default:
      text = 'No matching action';
      res.json(createFbResponse(text, contexts));
      break;
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
  const { tweet } = IFTTTData;
  return admin.database().ref(`${pageId}`).once('value').then((snapshot) => {
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
    .then(() => res.send('success'));
});
