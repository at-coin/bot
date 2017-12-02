const axios = require('axios');
const crypto = require('crypto');
const qs = require('qs');

const BX_API_URL = 'https://bx.in.th/api';

const CurrencyPairEnum = {
  'BTC-THB': '1',
  'ETH-THB': '21',
  'OMG-THB': '26',
};

class BxApi {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  createAuthFields() {
    const unixTime = Date.now() * 1000;
    const options = {
      key: this.apiKey,
      nonce: unixTime,
      signature: this.getSignature(unixTime),
    };
    return qs.stringify(options);
  }

  getSignature(nonce) {
    return crypto.createHash('sha256')
      .update(this.apiKey + nonce + this.apiSecret)
      .digest('hex');
  }

  mergeTransactions(transactions) {
    // merge time
    const timeTable = transactions.reduce((table, elem) => {
      const {
        amount, currency, date, type,
      } = elem;
      table[date] = table[date] || {};
      table[date][type] = table[date][type] || {};
      table[date][type][currency] = (table[date][type][currency] || 0) + parseFloat(amount);
      return table;
    }, {});
    return timeTable;
  }

  summarizeTransactions(timeTable, currency) {
    let thbSum = 0;
    let currencySum = 0;
    Object.keys(timeTable).forEach((key) => {
      const value = timeTable[key];
      if (value.trade && value.trade[currency] && value.trade.THB) {
        thbSum += value.trade.THB;
        currencySum += value.trade[currency];
      }
      if (value.trade && value.fee) {
        thbSum += value.fee.THB || 0;
        currencySum += value.fee[currency] || 0;
      }
    });
    return {
      THB: thbSum,
      [currency]: currencySum,
    };
  }

  calculateEthProfit(transactions, ethPrice) {
    const ethSummary = this.summarizeTransactions(transactions, 'ETH');
    return Object.assign(ethSummary, {
      ethPrice,
      netProfit: (ethSummary.ETH * ethPrice) + ethSummary.THB,
    });
  }

  calculateOmgProfit(transactions, omgPrice) {
    const omgSummary = this.summarizeTransactions(transactions, 'OMG');
    return Object.assign(omgSummary, {
      omgPrice,
      netProfit: (omgSummary.OMG * omgPrice) + omgSummary.THB,
    });
  }

  getAllTransactions() {
    const url = `${BX_API_URL}/history/`;
    return axios.post(url, this.createAuthFields())
      .then(res => this.mergeTransactions(res.data.transactions));
  }

  getBalances() {
    const url = `${BX_API_URL}/balance/`;
    return axios.post(url, this.createAuthFields())
      .then((res) => {
        if (!res.data || !res.data.success) {
          throw new Error(`unsuccessful requesting to ${url}`);
        }
        const balances = res.data.balance;
        const summary = {};
        Object.keys(balances).forEach((key) => {
          summary[key] = balances[key].total;
        });
        return summary;
      });
  }

  getBuyPrice(currencyPair) {
    const url = `${BX_API_URL}/`;
    return axios.get(url)
      .then(res => res.data[CurrencyPairEnum[currencyPair]]);
  }
}

module.exports = BxApi;
