// Earthquake data fetcher - polls USGS GeoJSON feed
import { CONFIG } from '../config.js';

let earthquakes = [];
let seenIds = new Set();
let lastFetch = null;
let onNewEarthquake = null;

export function setEarthquakeCallback(callback) {
  onNewEarthquake = callback;
}

export async function fetchEarthquakes() {
  try {
    const response = await fetch(CONFIG.apis.earthquakes);
    const data = await response.json();

    const newQuakes = [];

    for (const feature of data.features) {
      if (!seenIds.has(feature.id)) {
        seenIds.add(feature.id);
        newQuakes.push(feature);
      }
    }

    earthquakes = data.features;
    lastFetch = new Date();

    // Notify about new earthquakes
    if (onNewEarthquake && newQuakes.length > 0) {
      // Stagger notifications to avoid audio overload
      newQuakes.slice(0, 5).forEach((quake, i) => {
        setTimeout(() => onNewEarthquake(quake), i * 2500);
      });
    }

    return { earthquakes, newQuakes };
  } catch (error) {
    console.error('Failed to fetch earthquakes:', error);
    return { earthquakes, newQuakes: [] };
  }
}

export function getEarthquakes() {
  return earthquakes;
}

export function getEarthquakeStats() {
  if (earthquakes.length === 0) {
    return { count: 0, avgMag: 0, maxMag: 0 };
  }

  const mags = earthquakes
    .map(q => q.properties.mag)
    .filter(m => m != null);

  return {
    count: earthquakes.length,
    avgMag: mags.reduce((a, b) => a + b, 0) / mags.length,
    maxMag: Math.max(...mags)
  };
}

export function getLastFetchTime() {
  return lastFetch;
}

// Start periodic fetching
let fetchInterval = null;

export function startFetching() {
  if (fetchInterval) return;

  fetchEarthquakes(); // Initial fetch
  fetchInterval = setInterval(fetchEarthquakes, CONFIG.intervals.earthquakes);
}

export function stopFetching() {
  if (fetchInterval) {
    clearInterval(fetchInterval);
    fetchInterval = null;
  }
}
