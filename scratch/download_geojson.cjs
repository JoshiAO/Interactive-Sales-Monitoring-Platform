const https = require('https');
const fs = require('fs');

const url = 'https://raw.githubusercontent.com/macoymejia/geojsonph/master/Province/Nueva%20Ecija/Municipalities.json';

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error('Failed to get GeoJSON: ' + res.statusCode);
    return;
  }
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('public/nueva_ecija.geojson', data);
    console.log('Saved to public/nueva_ecija.geojson');
  });
}).on('error', err => {
  console.error(err);
});
