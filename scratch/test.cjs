const axios = require('axios');
const url = 'https://overpass-api.de/api/interpreter';
const query = `[out:json];
area["ISO3166-1"="PH"]->.ph;
(
  relation["name"~"Maria Aurora|Casiguran|Dilasag|Dinalungan|Dipaculao"](area.ph);
  way["name"~"Maria Aurora|Casiguran|Dilasag|Dinalungan|Dipaculao"]["boundary"="administrative"](area.ph);
);
out tags;`;

axios.post(url, "data=" + encodeURIComponent(query))
  .then(r => console.log(JSON.stringify(r.data.elements, null, 2)))
  .catch(e => console.error(e.message));
