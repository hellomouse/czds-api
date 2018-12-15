const CZDSClient = require('./index');
const credentials = require('./credentials.json');
const outdir = process.args[2] || './zones';
const client = new CZDSClient(credentials);

client.getZoneList().then((zones) => zones.map(async (zone) => {
  const size = await client.getZoneSize(zone);
  console.log(`Download .${zone} zonefile (${size} bytes)`);
  client.downloadZone(zone, `${outdir}/${zone}.${size}.zone`);
}));
