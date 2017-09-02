const axios = require('axios');
const crypto = require('crypto');
const hash = crypto.createHash('sha256');
const qs = require('qs');

const BX_API_URL = 'https://bx.in.th/api/';

const CurrencyPairEnum = {
  BTC_THB: '1',
  ETH_THB: '21',
  OMG_THB: '26',
};

class BxApi {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  calculateOmgProfit(transactions, omgPrice) {
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
    // find only omg trading
    let omgSum =0;
    let thbSum = 0;
    Object.keys(timeTable).forEach((key) => {
      const value = timeTable[key];
      if (value.trade && value.trade.OMG && value.trade.THB) {
        thbSum += value.trade.THB;
        omgSum += value.trade.OMG;
      }
      if (value.trade && value.fee) {
        thbSum += value.fee.THB || 0;
        omgSum += value.fee.OMG || 0;
      }
    });
    // get current price to calculate net profit.
    return {
      omg: omgSum,
      thb: thbSum,
      omgPrice: omgPrice,
      netProfit: (omgSum*omgPrice) + thbSum,
    };
  }

  getSignature(nonce) {
    return hash.update(this.apiKey + nonce + this.apiSecret).digest('hex');
  }

  getAllTransactions() {
    const url = `${BX_API_URL}history/`;
    const unixTime = Date.now()*1000;
    return axios.post(url, qs.stringify({
        key: this.apiKey,
        nonce: unixTime,
        signature: this.getSignature(unixTime),
      })).then((res) => {
        return res.data.transactions;
      });
  }

  getBtcToThb() {
    return axios.get(BX_API_URL)
      .then((res) => {
        return res.data[CurrencyPairEnum.BTC_THB];
      });
  }

  getEthToThb() {
    return axios.get(BX_API_URL)
      .then((res) => {
        return res.data[CurrencyPairEnum.ETH_THB];
      });
  }

  getOmgToThb() {
    return axios.get(BX_API_URL)
      .then((res) => {
        return res.data[CurrencyPairEnum.OMG_THB];
      });
  }

  getOmgToThbOnlyPrice() {
    return axios.get(BX_API_URL)
      .then((res) => {
        return res.data[CurrencyPairEnum.OMG_THB].last_price;
      });
  }
}

module.exports = BxApi;
