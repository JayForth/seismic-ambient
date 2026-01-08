// Main orchestration - ties everything together
import * as Tone from 'tone';
import { CONFIG, state, setUserLocation } from './config.js';

// Audio modules
import { initMasterChain, startAudio, setMasterMute } from './audio/engine.js';
import { initDroneLayer, startDrone, modulateDrone } from './audio/droneLayer.js';
import { initEarthquakeLayer, playEarthquakeVoice, getActiveVoiceCount } from './audio/earthquakeLayer.js';
import { initFlightLayer, startFlightLayer, startFlightTexture } from './audio/flightLayer.js';

// Data modules
import { fetchEarthquakes, getEarthquakes, getEarthquakeStats, setEarthquakeCallback, startFetching as startEarthquakeFetching, getLastFetchTime } from './data/earthquakes.js';
import { fetchFlights, getFlights, getFlightStats, setFlightsCallback, startFetching as startFlightFetching } from './data/flights.js';

// UI modules
import { initMap, addEarthquakeMarker, updateFlightMarkers } from './ui/map.js';
import { initSidebar, updateStats, updateActiveVoicesCount, updateEventList, updateWaveform, updateStatus, updateLastFetchTime } from './ui/sidebar.js';

// ============================================
// GEOLOCATION
// ============================================
function requestGeolocation() {
  return new Promise((resolve) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation(position.coords.latitude, position.coords.longitude);
          console.log('Location acquired:', position.coords.latitude, position.coords.longitude);
          resolve(true);
        },
        () => {
          console.log('Geolocation denied, using default');
          resolve(false);
        },
        { timeout: 10000 }
      );
    } else {
      resolve(false);
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
  console.log('Initializing Seismic Ambient...');

  // Request geolocation first (affects flight radius)
  await requestGeolocation();

  // Start audio context
  await startAudio();

  // Initialize audio chain
  initMasterChain();
  initDroneLayer();
  initEarthquakeLayer();
  initFlightLayer();

  // Initialize UI
  const mapContainer = document.getElementById('map-wrapper');
  initMap(mapContainer);
  initSidebar();

  // Set up data callbacks
  setEarthquakeCallback((quake) => {
    const voice = playEarthquakeVoice(quake);
    if (voice) {
      addEarthquakeMarker(quake, voice.duration);
      updateEventList();
      updateActiveVoicesCount(getActiveVoiceCount());
    }
  });

  setFlightsCallback((flights) => {
    updateFlightMarkers(flights);
  });

  // Start the drone
  startDrone();

  // Start the flight layer
  startFlightLayer();

  // Start data fetching
  startEarthquakeFetching();
  startFlightFetching();

  // Start flight texture generation
  startFlightTexture(getFlights);

  // Seed with initial earthquakes
  const { earthquakes } = await fetchEarthquakes();
  const seed = earthquakes.slice(0, 6);
  seed.forEach((quake, i) => {
    setTimeout(() => {
      const voice = playEarthquakeVoice(quake);
      if (voice) {
        addEarthquakeMarker(quake, voice.duration);
      }
    }, i * 3000 + 1000);
  });

  // Start UI update loops
  startUIUpdates();

  state.isRunning = true;
  updateStatus('Live', true);

  console.log('Seismic Ambient started');
}

// ============================================
// UI UPDATE LOOPS
// ============================================
function startUIUpdates() {
  // Fast update - waveform animation
  setInterval(() => {
    const voiceCount = getActiveVoiceCount() + (getFlights().length > 0 ? 5 : 0);
    updateWaveform(voiceCount, CONFIG.audio.earthquakes.maxVoices + 10);
  }, CONFIG.intervals.uiUpdate);

  // Stats update
  setInterval(() => {
    const eqStats = getEarthquakeStats();
    const flightStats = getFlightStats();

    updateStats(eqStats, flightStats);
    updateActiveVoicesCount(getActiveVoiceCount());
    updateEventList();

    // Update drone modulation based on earthquake activity
    modulateDrone(eqStats.avgMag, eqStats.count);

    // Update last fetch time
    updateLastFetchTime(getLastFetchTime());
  }, CONFIG.intervals.statsUpdate);
}

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const startOverlay = document.getElementById('start-overlay');
  const startBtn = document.getElementById('start-btn');

  startBtn.addEventListener('click', async () => {
    startOverlay.classList.add('hidden');
    await init();
  });

  // Handle tab visibility
  document.addEventListener('visibilitychange', () => {
    if (!state.isRunning) return;
    setMasterMute(document.hidden);
  });
});
