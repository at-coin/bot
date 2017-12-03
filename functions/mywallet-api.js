const axios = require('axios');
const tokenList = require('./ethTokens.json');

const ETHERSCAN_URL = 'http://api.etherscan.io/api';

class MyWalletApi {
  constructor(address, apiKey) {
    this.address = address;
    this.apiKey = apiKey;
  }

  convertWeiToFloat(wei) {
    return wei.substr(0, wei.length - 18) +
      '.' + wei.substr(wei.length - 18, wei.length - 15);
  }

  getBalances() {
    let baseParams = {
      module: 'account',
      action: 'tokenbalance',
      tag: 'latest',
      apikey: this.apiKey,
      address: this.address,
    }
    const balanceRequests = tokenList.map(token => {
      const params = Object.assign({}, baseParams, {
          contractaddress: token.address,
      });
      return axios.get(ETHERSCAN_URL, { params })
        .then(result => ({ [token.symbol]: this.convertWeiToFloat(result.data.result) }));
    });
    return Promise.all(balanceRequests)
      .then((values) => {
        return Object.assign({}, ...values);
      });
  }
}

module.exports = MyWalletApi;

