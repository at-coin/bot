const axios = require('axios');
const crypto = require('crypto');
const hash = crypto.createHash('sha256');

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

  getSignature(nonce) {
    return hash.update(this.apiKey + nonce + this.apiSecret).digest('hex');
  }

  getAllTransactions() {
    const url = `${BX_API_URL}history/`;
    const unixTime = Date.now();
    console.log('start sending axios request');
    return axios.post(url, {
        key: this.apiKey,
        nonce: unixTime,
        signature: this.getSignature(unixTime),
      }).then((res) => {
        console.log(res.data);
        return res;
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
