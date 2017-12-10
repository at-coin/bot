const cbLib = require('coinbase');
const axios = require('axios');
const qs = require('qs');

const CB_API_URL = 'https://api.coinbase.com/v2';

class CoinbaseApi {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.coinbase = new cbLib.Client({ apiKey, apiSecret });
  }

  getBuyPrice(currencyPair) {
    return new Promise((resolve, reject) => {
      this.coinbase.getBuyPrice({ currencyPair }, (err, cbObj) => {
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

  getAccountsWithTransactions() {
    const getTransactions = account => new Promise((resolve, reject) => {
      account.getTransactions(null, (err, transactions) => {
        if (err) {
          return reject(err);
        }
        account.transactions = transactions;
        return resolve(account);
      });
    });
    return this.getAccounts()
      .then((accounts) => {
        const accountsWithTransactions = accounts.map(account => getTransactions(account));
        return Promise.all(accountsWithTransactions);
      });
  }

  getTransactionsSummary() {
    return this.getAccountsWithTransactions().then((accounts) => {
      const allTransactions = accounts.reduce((result, account) => {
        if (account.type === 'wallet') {
          // Delete big unnecessary object
          account.transactions.map((single) => {
            delete single.account;
          });
          result[account.currency] = account.transactions;
        }
        return result;
      }, {});
      return allTransactions;
    });
  }

  getBalances() {
    return this.getAccountsWithTransactions().then((accounts) => {
      const balances = accounts.reduce((result, account) => {
        if (account.type === 'wallet') {
          result[account.currency] = account.balance.amount;
        }
        return result;
      }, {});
      return balances;
    });
  }
}

module.exports = CoinbaseApi;
