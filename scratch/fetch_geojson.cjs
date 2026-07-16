const axios = require('axios');
const fs = require('fs');
const osmtogeojson = require('osmtogeojson');

async function run() {
  const query = `[out:json];
area["name"="Nueva Ecija"]->.ne;
area["name"="Aurora"]["admin_level"="4"]->.au;
(
  relation["admin_level"="6"](area.ne);
  relation["admin_level"="6"](area.au);
);
out body;
>;
out skel qt;`;
  
  const url = 'https://overpass-api.de/api/interpreter';
  
  for (let i = 0; i < 3; i++) {
    try {
      console.log("Fetching from Overpass API (Attempt " + (i+1) + ")...");
      const response = await axios.post(url, "data=" + encodeURIComponent(query), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SalesMonitoringApp/1.0'
        },
        timeout: 60000
      });
      const geojson = osmtogeojson(response.data);
      
      // Clean up properties to just what we need (name)
      geojson.features = geojson.features.filter(f => f.properties && f.properties.name).map(f => ({
        type: "Feature",
        geometry: f.geometry,
        properties: {
          name: f.properties.name
        }
      }));
      
      fs.writeFileSync('./public/nueva_ecija.geojson', JSON.stringify(geojson));
      console.log("Saved geojson with " + geojson.features.length + " features!");
      return;
    } catch (err) {
      console.error("Error:", err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

run();
