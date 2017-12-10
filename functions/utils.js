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

module.exports = {
  summarizeCoinTransactions,
  summarizeExchangeSiteTransactions,
  summaryTmpl,
  addUpBalances,
  addUpType,
  calProfits,
};
