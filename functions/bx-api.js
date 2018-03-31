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
      let amount = parseFloat(elem.amount);
      const {
        currency, date, type,
      } = elem;
      table[date] = table[date] || {};
      table[date]['created_at'] = date;
      table[date]['source'] = 'bx';
      amount = parseFloat(amount);
      const negativeAmount = (amount < 0);
      amount = Math.abs(amount);
      if (type === 'fee') {
        table[date][type] = { amount, currency };
        table[date]['amount'] = { amount, currency };
        table[date]['curreny'] = currency;
      } else if (type === 'trade'){
        // TODO: Support more than just THB transactions
        if (currency === 'THB') {
          table[date]['type'] = (negativeAmount)? 'buy':'sell';
          table[date]['subtotal'] = { amount, currency };
          table[date]['native_amount'] = table[date]['subtotal'];
        } else {
          table[date]['currency'] = currency;
          table[date]['amount'] = { amount, currency };
        }
      } else {
        table[date]['type'] = table[date]['type'] || type;
        table[date]['currency'] = currency;
        table[date]['amount'] = { amount, currency };
      }
      return table;
    }, {});


    // Change back to array;
    // Also, find total; Sometimes, fee is missing.
    // We will just ignore by setting it to 0 for now.
    const array = Object.keys(timeTable).reduce((result, date) => {
      // conclude transactions w/ subtotal (type === sell, buy)
      if ('subtotal' in timeTable[date]) {
        // if having subtotal w/o fee, just set fee to 0.
        if (!('fee' in timeTable[date])) {
          timeTable[date]['fee'] = { amount: 0, currency: 'THB' };
        }
        timeTable[date]['native_amount'] = {
          amount: (timeTable[date].fee.amount + timeTable[date].subtotal.amount),
          currency: timeTable[date].subtotal.currency,
        }
      }
      result.push(timeTable[date]);
      return result;
    }, []);
    return array;
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

  getAllTransactions() {
    const url = `${BX_API_URL}/history/`;
    return axios.post(url, this.createAuthFields())
      .then(res => this.mergeTransactions(res.data.transactions));
  }

  getTransactionsSummary() {
    return this.getAllTransactions().then((transactions) => {
      const allTransactions = transactions.reduce((result, transaction) => {
        const currency = transaction.currency;
        result[currency] = result[currency] || [];
        result[currency].push(transaction);
        return result;
      }, {});
      return allTransactions;
    });
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
      .then(res => {
        const pairs = res.data;
        const allBuyPrices = {};
        Object.keys(pairs).map((key) => {
          const value = pairs[key];
          const primary = value.primary_currency;
          const secondary = value.secondary_currency;
          allBuyPrices[primary] = allBuyPrices[primary] || {};
          allBuyPrices[primary][secondary] = value;
        });
        if (currencyPair) {
          console.log(`[BxApi].getBuyPrice for ${currencyPair}.`);
          const primary = currencyPair.split('-')[0];
          const secondary = currencyPair.split('-')[1];
          if (!(primary in allBuyPrices) ||
            !(secondary in allBuyPrices[primary])) {
            return undefined;
          }
          return allBuyPrices[primary][secondary];
        } else {
          console.log(`[BxApi].getBuyPrice for all currencies.`);
        }
        return allBuyPrices;
      });
  }
}

module.exports = BxApi;
