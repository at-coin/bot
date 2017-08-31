const axios = require('axios');

const BX_API_URL = 'https://bx.in.th/api/';

const CurrencyPairEnum = {
  ETH_THB: '21',
  OMG_THB: '26',
};

class BxApi {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
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
