const cbLib = require('coinbase');

class CoinbaseApi {
  constructor(apiKey, apiSecret) {
    this.coinbase = new cbLib.Client({apiKey, apiSecret});
  }

  getBuyPrice(currencyPair) {
    return new Promise((resolve, reject) => {
      this.coinbase.getBuyPrice(
        {currencyPair}, (err, cbObj) => {
          if (err) {
            return reject(err);
          }
          return resolve(cbObj);
        });
    });
  }
}

module.exports = CoinbaseApi;
