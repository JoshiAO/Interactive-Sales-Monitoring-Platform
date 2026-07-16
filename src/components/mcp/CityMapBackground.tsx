import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap, Marker, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { extractAllTownCoordinates } from './nuevaEcijaCoordinates';

interface CityMapBackgroundProps {
  towns: string[];
  selectedCity?: string | null;
}

const MapController: React.FC<{ coords: [number, number][], selectedCoord?: [number, number] | null }> = ({ coords, selectedCoord }) => {
  const map = useMap();

  useEffect(() => {
    map.stop(); // Immediately halt any ongoing map animations before calculating new ones
    if (selectedCoord) {
      map.flyTo(selectedCoord, 12, { duration: 1.5 });
    } else if (coords.length > 0) {
      if (coords.length === 1) {
        map.flyTo(coords[0], 11, { duration: 1.5 });
      } else {
        const bounds = L.latLngBounds(coords);
        // The container is 400% of the screen. We want bounds to fit in the center 50% of the screen.
        // So we apply massive padding in pixels based on the window size.
        const padX = window.innerWidth * 1.2;
        const padY = window.innerHeight * 1.2;

        map.flyToBounds(bounds, {
          padding: [padX, padY],
          duration: 1.5,
          easeLinearity: 0.25
        });
      }
    } else {
      map.flyTo([15.6, 120.9], 10, { duration: 1.5 });
    }
  }, [coords, map]);

  return null;
};

const CityMapBackground: React.FC<CityMapBackgroundProps> = ({ towns, selectedCity }) => {
  if (!towns || towns.length === 0) return null;

  // Resolve valid coordinates
  const townCoords = useMemo(() => {
    return extractAllTownCoordinates(towns);
  }, [towns]);

  // Project lat/lng to percentage-based coordinates for the HTML overlay.
  // This allows the HTML labels to sync perfectly with the CSS 3D transform without using expensive Leaflet DivIcons.
  // We use Leaflet's built-in projection inside a hook, OR we just use Leaflet Markers.
  // We use Leaflet Markers is vastly superior for exact placement!
  
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    fetch('/nueva_ecija.geojson')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Could not load geojson:", err));
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0, bottom: 0, width: '75%',
      zIndex: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      opacity: 0.85,
      maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
      WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: '400%', // Massively expanded to ensure no corners/edges are visible during 3D tilt
        height: '400%',
        transform: 'translate(-50%, -50%) perspective(1200px) rotateX(55deg) rotateZ(-35deg) scale(1.2)',
        transformStyle: 'preserve-3d'
      }}>
        <MapContainer
          center={[15.6, 120.9]}
          zoom={10}
          zoomControl={false}
          attributionControl={false}
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          {/* CartoDB Dark Matter with labels, borders, and roads */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapController 
            coords={townCoords.map(tc => tc.coord)} 
            selectedCoord={selectedCity ? townCoords.find(tc => tc.name === selectedCity)?.coord || null : null}
          />
          {geoData && (
            <GeoJSON 
              data={geoData} 
              style={(feature) => {
                const normalize = (n: string) => {
                  let str = (n || '').toUpperCase().trim();
                  str = str.replace(/ \(.+\)/, ''); // Remove (PAPAYA), etc.
                  str = str.replace('CITY OF ', '').replace(' CITY', '').replace('SCIENCE ', '');
                  if (str.includes('MUNOZ') || str.includes('MUÑOZ')) return 'MUNOZ';
                  return str.trim();
                };

                const geoName = normalize(feature?.properties?.name);
                const sel = selectedCity ? normalize(selectedCity) : null;
                const activeTowns = towns.map(normalize);

                // If a city is explicitly selected, highlight ONLY that one and hide others.
                // Otherwise, highlight all cities in the salesman's coverage area.
                const isSelected = sel ? geoName === sel : activeTowns.includes(geoName);
                const isOther = sel && geoName !== sel;

                return {
                  color: isSelected ? 'rgba(147, 197, 253, 0.5)' : (isOther ? 'transparent' : '#4B5563'),
                  weight: isSelected ? 2 : 1,
                  fillOpacity: isSelected ? 0.15 : (isOther ? 0 : 0.05),
                  fillColor: isSelected ? '#3B82F6' : '#1F2937',
                  dashArray: isSelected ? '' : '4',
                  className: isSelected ? 'glowing-polygon' : ''
                };
              }}
            />
          )}
          {/* Exact Pins on actual coordinates */}
          {townCoords.map(tc => {
            const icon = L.divIcon({
              className: 'custom-map-marker',
              html: `
                <div style="display: flex; flex-direction: column; align-items: center; transform: matrix(0.81915, 0.57357, -1, 1.42816, 0, 0) translateY(-20px); transform-origin: bottom center;">
                  <div style="color: #FFFFFF; font-size: 14px; font-weight: 700; text-shadow: 0px 2px 4px rgba(0,0,0,1), 0px 4px 12px rgba(0,0,0,0.8), 0 0 10px rgba(59, 130, 246, 0.9); white-space: nowrap; letter-spacing: 0.05em; font-family: sans-serif; padding: 2px 6px; background: rgba(0,0,0,0.8); border-radius: 4px; border: 1px solid rgba(59,130,246,0.3);">
                    ${tc.name}
                  </div>
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #60A5FA; box-shadow: 0 0 20px 6px rgba(59, 130, 246, 0.8); margin-top: 6px;"></div>
                </div>
              `,
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            });
            return (
              <Marker key={tc.name} position={tc.coord} icon={icon} />
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default CityMapBackground;
