// Map visualization module
import { CONFIG } from '../config.js';

let mapContainer = null;
let markersGroup = null;
let flightMarkersGroup = null;

// World map SVG paths (simplified but recognizable continents)
const WORLD_MAP_SVG = `
  <!-- Graticule (grid lines) -->
  <g class="graticule">
    <line x1="0" y1="250" x2="1000" y2="250" />
    <line x1="500" y1="0" x2="500" y2="500" />
    <path d="M0,125 H1000 M0,375 H1000" />
    <path d="M250,0 V500 M750,0 V500" />
  </g>

  <!-- Landmasses -->
  <g class="landmasses">
    <!-- North America -->
    <path class="land" d="M130,60 L180,55 L220,65 L250,58 L270,70 L265,95 L250,110 L270,115 L285,105 L295,120 L280,140 L260,145 L240,160 L225,180 L210,175 L190,190 L175,210 L160,205 L150,220 L140,210 L120,215 L105,200 L95,180 L85,160 L90,140 L80,120 L85,100 L100,85 L115,75 Z"/>
    <!-- Greenland -->
    <path class="land" d="M320,45 L360,40 L390,50 L395,75 L380,95 L350,100 L325,90 L310,70 Z"/>
    <!-- South America -->
    <path class="land" d="M200,230 L230,225 L255,235 L275,260 L285,290 L280,330 L265,370 L245,400 L220,420 L195,410 L180,380 L175,340 L185,300 L180,260 Z"/>
    <!-- Europe -->
    <path class="land" d="M450,80 L480,75 L510,80 L530,95 L525,115 L540,120 L555,110 L570,115 L560,135 L540,145 L510,150 L480,145 L455,135 L445,115 L450,95 Z"/>
    <!-- UK/Ireland -->
    <path class="land" d="M430,95 L445,90 L450,105 L440,115 L425,110 Z"/>
    <!-- Africa -->
    <path class="land" d="M460,165 L500,160 L540,170 L570,190 L590,230 L585,280 L570,330 L540,370 L500,385 L460,375 L440,340 L435,290 L445,240 L440,200 Z"/>
    <!-- Asia -->
    <path class="land" d="M560,70 L620,60 L680,55 L740,60 L800,75 L850,90 L880,110 L890,140 L870,170 L840,190 L800,200 L760,195 L720,205 L680,200 L640,190 L600,195 L570,180 L555,155 L565,130 L560,100 Z"/>
    <!-- Middle East -->
    <path class="land" d="M570,160 L600,155 L620,165 L615,190 L590,200 L565,190 Z"/>
    <!-- India -->
    <path class="land" d="M680,200 L720,195 L740,220 L730,260 L700,290 L670,280 L660,245 L665,215 Z"/>
    <!-- Southeast Asia -->
    <path class="land" d="M760,210 L800,205 L830,220 L820,250 L790,260 L760,250 Z"/>
    <!-- Indonesia -->
    <path class="land" d="M780,280 L820,275 L860,285 L890,295 L880,315 L840,320 L800,315 L770,300 Z"/>
    <!-- Japan -->
    <path class="land" d="M870,130 L885,125 L895,140 L890,160 L875,170 L865,155 Z"/>
    <!-- Australia -->
    <path class="land" d="M820,340 L880,330 L920,345 L940,380 L930,420 L890,440 L840,435 L810,410 L800,375 Z"/>
    <!-- New Zealand -->
    <path class="land" d="M950,420 L965,415 L970,440 L955,455 L940,445 Z"/>
    <!-- Antarctica hint -->
    <path class="land antarctica" d="M200,485 L400,480 L600,485 L800,480 L850,490 L150,490 Z"/>
  </g>

  <!-- Tectonic plate boundaries (subtle) -->
  <g class="plates">
    <path d="M100,200 Q200,250 180,350 Q160,420 200,480"/>
    <path d="M280,230 Q320,280 300,380"/>
    <path d="M460,160 L470,480"/>
    <path d="M560,100 Q620,200 600,350 Q580,420 620,480"/>
    <path d="M700,60 Q780,150 800,300 Q820,400 780,480"/>
    <path d="M850,100 Q900,200 920,350"/>
  </g>

  <!-- Marker groups -->
  <g id="flight-markers"></g>
  <g id="quake-markers"></g>
`;

export function initMap(containerElement) {
  mapContainer = containerElement;

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'world-map');
  svg.setAttribute('viewBox', '0 0 1000 500');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = WORLD_MAP_SVG;

  mapContainer.appendChild(svg);

  markersGroup = document.getElementById('quake-markers');
  flightMarkersGroup = document.getElementById('flight-markers');

  return svg;
}

function latLonToSvg(lat, lon) {
  const x = ((lon + 180) / 360) * CONFIG.visual.map.width;
  const y = ((90 - lat) / 180) * CONFIG.visual.map.height;
  return { x, y };
}

export function addEarthquakeMarker(quake, duration) {
  if (!markersGroup) return;

  const [lon, lat] = quake.geometry.coordinates;
  const { x, y } = latLonToSvg(lat, lon);
  const mag = quake.properties.mag;
  const isMajor = mag >= CONFIG.audio.earthquakes.majorThreshold;

  // Pulse animation
  const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  pulse.setAttribute('cx', x);
  pulse.setAttribute('cy', y);
  pulse.setAttribute('r', 2);
  pulse.classList.add('quake-pulse');
  if (isMajor) pulse.classList.add('major');
  markersGroup.appendChild(pulse);
  setTimeout(() => pulse.remove(), isMajor ? 6000 : 4000);

  // Persistent marker
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  marker.setAttribute('cx', x);
  marker.setAttribute('cy', y);
  marker.setAttribute('r', Math.max(2, Math.min(mag * 1.2, 12)));
  marker.classList.add('quake-marker');
  if (isMajor) marker.classList.add('major');
  marker.dataset.id = quake.id;
  markersGroup.appendChild(marker);

  // Fade out with voice duration
  const fadeStart = duration - 3000;
  setTimeout(() => {
    marker.style.transition = 'opacity 3s ease';
    marker.style.opacity = '0';
    setTimeout(() => marker.remove(), 3000);
  }, Math.max(0, fadeStart));
}

export function updateFlightMarkers(flights) {
  if (!flightMarkersGroup) return;

  // Clear existing flight markers
  flightMarkersGroup.innerHTML = '';

  // Add new markers (limit for performance)
  const displayFlights = flights.slice(0, 100);

  displayFlights.forEach(flight => {
    const { x, y } = latLonToSvg(flight.latitude, flight.longitude);

    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('cx', x);
    marker.setAttribute('cy', y);
    marker.setAttribute('r', 1.5);
    marker.classList.add('flight-marker');

    // Rotate based on heading if we want to show direction
    // For now, just a simple dot

    flightMarkersGroup.appendChild(marker);
  });
}

export function clearFlightMarkers() {
  if (flightMarkersGroup) {
    flightMarkersGroup.innerHTML = '';
  }
}
