// Configuration and thresholds for Seismic Ambient

export const CONFIG = {
  // API endpoints
  apis: {
    earthquakes: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    flights: 'https://opensky-network.org/api/states/all'
  },

  // Polling intervals (ms)
  intervals: {
    earthquakes: 60000,    // 1 minute
    flights: 15000,        // 15 seconds (OpenSky rate limit friendly)
    uiUpdate: 100,         // Waveform animation
    statsUpdate: 3000      // Sidebar refresh
  },

  // Audio settings
  audio: {
    // Drone layer
    drone: {
      baseNotes: ['C2', 'G2', 'C3', 'G3'],
      filterRange: { min: 200, max: 600 },
      volume: -20
    },

    // Earthquake voices
    earthquakes: {
      maxVoices: 15,
      durationRange: { min: 120, max: 600 }, // 2-10 minutes (extended)
      volumeRange: { min: -24, max: -8 },
      majorThreshold: 5.5,
      scale: [0, 2, 4, 7, 9, 12, 14, 16], // Extended pentatonic
      baseNote: 36 // C2 MIDI
    },

    // Flight layer
    flights: {
      maxVoices: 50,
      radiusKm: 3000,        // Only render flights within this radius
      altitudeRange: { min: 0, max: 45000 }, // feet
      pitchRange: { min: 400, max: 2000 },   // Hz
      volume: -28,           // Quiet shimmer
      grainSize: 0.1,
      updateRate: 2000       // How often to update flight sounds
    },

    // Master chain
    master: {
      reverbDecay: 10,
      reverbWet: 0.35,
      compressorThreshold: -18,
      limiterThreshold: -2
    }
  },

  // Visual settings
  visual: {
    map: {
      width: 1000,
      height: 500
    },
    colors: {
      earthquakes: 'rgba(100, 160, 180, 0.7)',
      earthquakesMajor: 'rgba(180, 130, 100, 0.8)',
      flights: 'rgba(200, 200, 255, 0.4)',
      land: '#1a1a25',
      landStroke: '#2a2a3a'
    },
    waveformBars: 80
  }
};

// Default user location (US center) if geolocation denied
export const DEFAULT_LOCATION = {
  latitude: 39.8283,
  longitude: -98.5795
};

// State management
export const state = {
  userLocation: null,
  isRunning: false,
  layers: {
    drone: true,
    earthquakes: true,
    flights: true
  }
};

export function setUserLocation(lat, lon) {
  state.userLocation = { latitude: lat, longitude: lon };
}

export function getUserLocation() {
  return state.userLocation || DEFAULT_LOCATION;
}
