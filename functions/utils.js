const admin = require('firebase-admin');
const _ = require('lodash');

const summarizeCoinTransactions = (transactions) => {
  return transactions.reduce((result, one) => {
    const { type } = one;
    if(type === 'buy' || type === 'sell') {
      const {currency, amount} = one.native_amount;
      result[type] = result[type] || {};
      result[type][currency] = result[type][currency] || 0;
      result[type][currency] += parseFloat(amount);
    } else {
      const {currency, amount} = one.amount;
      result[type] = result[type] || {};
      result[type][currency] = result[type][currency] || 0;
      result[type][currency] += parseFloat(amount);
    }
    return result;
  }, {});
};

const summarizeExchangeSiteTransactions = (allCoinTransactions) => {
  let summary = {};
  Object.keys(allCoinTransactions).map(key => {
    summary[key] = summarizeCoinTransactions(allCoinTransactions[key]);
  });
  return summary;
};

const summaryTmpl = (siteName, summary) => {
  let result = `[${siteName}]\n`;
  Object.keys(summary).forEach((coin) => {
    result += `${coin}\n`;
    const coinTrans = summary[coin];
    Object.keys(coinTrans).forEach((type) => {
      result += `* ${type} `;
      const amount = coinTrans[type];
      let delim = '';
      Object.keys(amount).forEach((currency) => {
        result += `${delim} ${parseFloat(amount[currency])} ${currency}`;
        delim = ',';
      });
      result += '\n';
    });
  });
  return result;
};

const addUpBalances = (newBalances, sumBalances) => {
  Object.keys(newBalances).forEach((key) => {
    const amount = parseFloat(newBalances[key]);
    if (!amount) return;
    sumBalances[key] = sumBalances[key] || 0;
    sumBalances[key] += parseFloat(newBalances[key]);
  });
}

const addUpType = (newTrans, sumTrans, type, rates) => {
  Object.keys(newTrans).forEach((key) => {
    // If no buy transaction, skip.
    if (!(type in newTrans[key])) return;
    let amount = (newTrans[key][type].THB || 0);
    amount += (newTrans[key][type].SGD || 0) * rates.SGD;
    sumTrans[key] = (sumTrans[key] || 0) + amount;
  });
}

const calProfits = (balances, buys, sells, buyPrices) => {
  const allCoins = [
    ...Object.keys(balances),
    ...Object.keys(buys),
    ...Object.keys(sells),
  ];
  const result = {};
  allCoins.map((coin) => {
    result[coin] = {};
    result[coin]['buy'] = (buys[coin] || 0);
    result[coin]['sell'] = (sells[coin] || 0);
    result[coin]['balances'] = (balances[coin] || 0);
    if (coin in buyPrices['THB']) {
      result[coin]['profit'] =
        sells[coin] - buys[coin] + (balances[coin] * buyPrices['THB'][coin].last_price);
      result[coin]['ifLost'] = sells[coin] - buys[coin];
    }
  });
  return result;
}

const getBalancesAndRecordToDb = (exApi, dbPath) => {
  return exApi.getBalances()
    .catch((err) => {
      console.error(err);
      return {};
    })
    .then((oldBalances) => {
      console.log(oldBalances);
      return Promise.all([
        oldBalances,
        admin.database().ref(dbPath).once('value'),
      ]);
    })
    .then((values) => {
      const newBalances = values[0] || {};
      const oldBalances = values[1].val() || {};
      const latestBalances = Object.assign({}, oldBalances, newBalances);
      return admin.database().ref(dbPath).set(latestBalances).then(() => latestBalances);
    });
};

// TODO: Check only the latest missing transactions.
// Currently, we are checking the whole thing and merging them.
const getAllTransactionsAndRecordToDb = (exApi, dbPath) => {
  return Promise.all([
    exApi.getTransactionsSummary(),
    admin.database().ref(dbPath).once('value'),
  ]).then((values) => {
    const newTrans = values[0] || {};
    const oldTrans = values[1].val() || {};
    const allCoins = [
      ...Object.keys(newTrans),
      ...Object.keys(oldTrans),
    ];
    function transactionEqual(a, b) {
      return (a.created_at === b.created_at) && (_.isEqual(a.amount, b.amount));
    }
    const latestTrans = {};
    allCoins.map((coin) => {
      newTrans[coin] = newTrans[coin] || [];
      oldTrans[coin] = oldTrans[coin] || [];
      latestTrans[coin] = _.unionWith(newTrans[coin], oldTrans[coin], transactionEqual);
      // Temporary populate native_amount value;
      /*latestTrans[coin] = latestTrans[coin].map((item) => {
        if (item.native_amount) return item;
        const fee = item.fee? item.fee.amount : 0;
        if (!item.subtotal) return item;
        item['native_amount'] = {
          amount: item.subtotal.amount + fee,
          currency: item.subtotal.currency,
        }
        return item;
      });*/
    });
    return admin.database().ref(dbPath).set(latestTrans).then(() => latestTrans);
  });
};


module.exports = {
  addUpBalances,
  addUpType,
  calProfits,
  getBalancesAndRecordToDb,
  getAllTransactionsAndRecordToDb,
  summarizeCoinTransactions,
  summarizeExchangeSiteTransactions,
  summaryTmpl,
};
