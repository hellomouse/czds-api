const request = require('request-promise');
const requestStream = require('request');
const base64url = require('base64url');
const fs = require('fs');
const {createGunzip} = require('zlib');

const HOUR = 60 * 60 * 1000;
/** A CZDS Client Instance */
module.exports = class CZDSClient {
/**
 * Creates a CZDS Client Instance
 * @param {object} opts - Options for the client
 * @param {string} opts.username - Username for acessing the CZDS API
 * @param {string} opts.password - Password for acessing the CZDS API
 * @param {boolean} opts.test - Sets the client to default to test endpoints
 * @param {string} opts.authenticationEndpoint - Base URL for the CZDS Auth API
 * @param {string} opts.password - Base URL for the CZDS Zone API
 */
  constructor(opts) {
    if (!opts.username) throw new Error('Username is a required field');
    if (!opts.password) throw new Error('Password is a required field');
    this.username = opts.username;
    this.password = opts.password;
    this.test = Boolean(opts.test);
    this.authenticationEndpoint = opts.authenticationEndpoint ||
      this.test ? 'https://account-api-test.icann.org' : 'https://account-api.icann.org';
    this.apiEndpoint = opts.apiEndpoint ||
      this.test ? 'https://czds-api-test.icann.org' : 'https://czds-api.icann.org';
    this.jwt = null;
  }
  /**
 * Logins to the CZDS API
 * @async
 * @return {Promise<string>} - A JWT Token to acess the API
 */
  async login() {
    return request({
      method: 'POST',
      uri: this.authenticationEndpoint + '/api/authenticate',
      body: {
        username: this.username,
        password: this.password,
      },
      headers: {
        'User-Agent': 'CZDS-API Client',
      },
      json: true,
    })
        .then((body) => this.jwt = body.accessToken);
  }
  /**
 * Checks if the stored JWT token is valid, else request a new one
 * @async
 * @return {Promise<string>} - A JWT Token to acess the API
 */
  async getValidToken() {
    if (!this.jwt) return this.login();
    const payload = base64url.decode(this.jwt.split('.')[1]);
    const expiry = new Date(JSON.parse(payload).expiry*1000);
    if (expiry < Date.now() + HOUR) return this.login();
    return Promise.resolve(this.jwt);
  }
  /**
 * Generates appropiate headers for usage with CZDS
 * @async
 * @return {Promise<object>} - An object with headers for usage with CZDS
 */
  async getHeaders() {
    const token = await this.getValidToken();
    return {
      'User-Agent': 'CZDS-API Client',
      'Authorization': 'Bearer ' + token,
    };
  }
  /**
 * Fetches zones list
 * @async
 * @return {Promise<array>} - An array of acessable zonefiles
 */
  async getZoneList() {
    const headers = await this.getHeaders();
    return request({
      method: 'GET',
      headers,
      uri: this.apiEndpoint + '/czds/downloads/links',
      json: true,
    }).then((list) => list.map(
        (link) => link.match(/.*?\/czds\/downloads\/(.*?)\.zone/i)[1]
    ));
  }
  /**
 * Fetches total size (in bytes) of the zonefile
 * @async
 * @param {string} zone - Name of the zonefile
 * @return {Promise<number>} - Size of the zonefile
 */
  async getZoneSize(zone) {
    const headers = await this.getHeaders();
    return request({
      method: 'HEAD',
      headers,
      uri: `${this.apiEndpoint}/czds/downloads/${zone}.zone`,
      json: false,
    }).then((responseHeaders) => responseHeaders['content-length']);
  }
  /**
 * Generates appropiate headers for usage with CZDS
 * @async
 * @param {string} zone - Name of the zonefile
 * @param {string} outFile - Output filename
 */
  async downloadZone(zone, outFile) {
    const headers = await this.getHeaders();
    const gunzip = createGunzip();
    requestStream({
      method: 'GET',
      headers,
      uri: `${this.apiEndpoint}/czds/downloads/${zone}.zone`,
      json: false,
    }).pipe(gunzip).pipe(fs.createWriteStream(outFile));
  }
};
