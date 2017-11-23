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

  getAccounts() {
    return new Promise((resolve, reject) => {
      this.coinbase.getAccounts({}, (err, accounts) => {
          if (err) {
            return reject(err);
          }
          return resolve(accounts);
        });
    });
  }

  getAllTransactions() {
    const getTransactions = (account) => {
      return new Promise((resolve, reject) => {
        account.getTransactions(null, (err, transactions) => {
            if (err) {
              return reject(err);
            }
            return resolve(transactions);
          });
      });
    };
    return this.getAccounts()
      .then(accounts => {
        const allTransactions = accounts.map(account => getTransactions(account));
        return Promise.all(allTransactions);
      });
  }
}

module.exports = CoinbaseApi;
