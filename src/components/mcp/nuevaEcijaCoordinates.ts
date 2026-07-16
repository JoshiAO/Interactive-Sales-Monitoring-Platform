// Exact coordinates for Nueva Ecija municipalities and neighboring areas commonly assigned

export const NUEVA_ECIJA_COORDINATES: Record<string, [number, number]> = {
  "CABANATUAN": [15.4865, 120.9734],
  "CABANATUAN CITY": [15.4865, 120.9734],
  "PALAYAN": [15.5414, 121.0850],
  "PALAYAN CITY": [15.5414, 121.0850],
  "SAN JOSE": [15.7905, 120.9902],
  "SAN JOSE CITY": [15.7905, 120.9902],
  "GAPAN": [15.3129, 120.9472],
  "GAPAN CITY": [15.3129, 120.9472],
  "CITY OF GAPAN": [15.3129, 120.9472],
  "MUNOZ": [15.7118, 120.9069],
  "MUÑOZ": [15.7118, 120.9069],
  "SCIENCE CITY OF MUNOZ": [15.7118, 120.9069],
  "SCIENCE CITY OF MUÑOZ": [15.7118, 120.9069],
  "GUIMBA": [15.6599, 120.7681],
  "ZARAGOZA": [15.4419, 120.7788],
  "SANTA ROSA": [15.4243, 120.9405],
  "LICAB": [15.5583, 120.7601],
  "NAMPICUAN": [15.7271, 120.6409],
  "CUYAPO": [15.7797, 120.6657],
  "TALUGTUG": [15.7758, 120.8143],
  "SANTO DOMINGO": [15.5898, 120.8647],
  "ALIAGA": [15.5133, 120.8359],
  "BONGABON": [15.6267, 121.1441],
  "LAUR": [15.5816, 121.1857],
  "GABALDON": [15.4528, 121.3323],
  "DINGALAN": [15.3853, 121.3969], // Aurora
  "SAN LEONARDO": [15.3621, 120.9602],
  "GENERAL MAMERTO NATIVIDAD": [15.6027, 121.0504],
  "GEN. MAMERTO NATIVIDAD": [15.6027, 121.0504],
  "JAEN": [15.3342, 120.9000],
  "SAN ANTONIO": [15.2954, 120.8449],
  "CABIAO": [15.2475, 120.8522],
  "SAN ISIDRO": [15.3129, 120.8872],
  "PENARANDA": [15.3533, 121.0028],
  "PEÑARANDA": [15.3533, 121.0028],
  "GENERAL TINIO": [15.3551, 121.0478],
  "GEN. TINIO": [15.3551, 121.0478],
  "LLANERA": [15.6569, 120.9856],
  "RIZAL": [15.7068, 121.1070],
  "PANTABANGAN": [15.8202, 121.1578],
  "CARRANGLAN": [15.9463, 121.0116],
  "LUPAO": [15.8753, 120.9002],
  "QUEZON": [15.5802, 120.8143],
  "TALAVERA": [15.5861, 120.9202],
  "ALFONSO CASTANEDA": [15.7876, 121.2882], // Nueva Vizcaya
  
  // Aurora Province
  "BALER": [15.7587, 121.5620],
  "CASIGURAN": [16.2825, 122.1154],
  "DILASAG": [16.4831, 122.2133],
  "DINALUNGAN": [16.1432, 121.9168],
  "DIPACULAO": [15.9868, 121.7247],
  "MARIA AURORA": [15.7951, 121.4727],
  "SAN LUIS": [15.7000, 121.5333]
};

export const getTownCoordinates = (townName: string): [number, number] | null => {
  const normalized = townName.trim().toUpperCase().replace(/ \(.+\)/, ''); // Remove trailing notes like "(CAPITAL)"
  return NUEVA_ECIJA_COORDINATES[normalized] || null;
};

export const extractAllTownCoordinates = (townsList: string[]): { name: string, coord: [number, number] }[] => {
  const valid: { name: string, coord: [number, number] }[] = [];
  
  // If the array contains a single string with commas, split it
  const allTowns = townsList.length === 1 && townsList[0].includes(',')
    ? townsList[0].split(',')
    : townsList;
    
  allTowns.forEach(t => {
    const coord = getTownCoordinates(t);
    if (coord) valid.push({ name: t.trim(), coord });
  });
  
  // Sort from North to South (highest latitude first)
  valid.sort((a, b) => b.coord[0] - a.coord[0]);
  
  return valid;
};
