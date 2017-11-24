const axios = require('axios');
const crypto = require('crypto');
const qs = require('qs');

const BX_API_URL = 'https://bx.in.th/api/';

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

  mergeTransactions(transactions) {
    // merge time
    const timeTable = transactions.reduce((table, elem) => {
      const id = elem.transaction_id;
      const currency = elem.currency;
      const date = elem.date;
      const amount = elem.amount;
      const type = elem.type;
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
      ethPrice: ethPrice,
      netProfit: (ethSummary.ETH * ethPrice) + ethSummary.THB,
    });
  }

  calculateOmgProfit(transactions, omgPrice) {
    const omgSummary = this.summarizeTransactions(transactions, 'OMG');
    return Object.assign(omgSummary, {
      omgPrice: omgPrice,
      netProfit: (omgSummary.OMG * omgPrice) + omgSummary.THB,
    });
  }

  getSignature(nonce) {
    return crypto.createHash('sha256')
      .update(this.apiKey + nonce + this.apiSecret)
      .digest('hex');
  }

  getAllTransactions() {
    const url = `${BX_API_URL}history/`;
    const unixTime = Date.now()*1000;
    const options = {
      key: this.apiKey,
      nonce: unixTime,
      signature: this.getSignature(unixTime),
    };
    return axios.post(url, qs.stringify(options)).then((res) => {
        return this.mergeTransactions(res.data.transactions);
      });
  }

  getBuyPrice(currencyPair) {
    return axios.get(BX_API_URL)
      .then((res) => {
        return res.data[CurrencyPairEnum[currencyPair]];
      });
  }
}

module.exports = BxApi;
