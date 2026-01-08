// Flight data fetcher - polls OpenSky Network API
import { CONFIG } from '../config.js';
import { getUserLocation } from '../config.js';

let flights = [];
let lastFetch = null;
let onFlightsUpdated = null;

export function setFlightsCallback(callback) {
  onFlightsUpdated = callback;
}

// Calculate distance between two coordinates in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function fetchFlights() {
  try {
    const location = getUserLocation();
    const { radiusKm } = CONFIG.audio.flights;

    // OpenSky API - get all states
    // Note: For better performance, we could use bounding box params
    // but the free tier has limitations
    const response = await fetch(CONFIG.apis.flights);

    if (!response.ok) {
      // OpenSky rate limiting - back off gracefully
      if (response.status === 429) {
        console.warn('OpenSky rate limited, will retry next interval');
        return { flights, count: flights.length };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.states) {
      return { flights, count: 0 };
    }

    // Filter to flights within radius of user
    // OpenSky state vector format:
    // [0] icao24, [1] callsign, [2] origin_country, [3] time_position,
    // [4] last_contact, [5] longitude, [6] latitude, [7] baro_altitude,
    // [8] on_ground, [9] velocity, [10] true_track, [11] vertical_rate,
    // [12] sensors, [13] geo_altitude, [14] squawk, [15] spi, [16] position_source

    const nearbyFlights = data.states
      .filter(state => {
        const lon = state[5];
        const lat = state[6];
        const onGround = state[8];

        // Skip if no position or on ground
        if (lon === null || lat === null || onGround) return false;

        const distance = haversineDistance(location.latitude, location.longitude, lat, lon);
        return distance <= radiusKm;
      })
      .map(state => ({
        icao24: state[0],
        callsign: (state[1] || '').trim(),
        country: state[2],
        longitude: state[5],
        latitude: state[6],
        altitude: state[7] || state[13] || 0, // baro or geo altitude in meters
        velocity: state[9] || 0, // m/s
        heading: state[10] || 0,
        verticalRate: state[11] || 0,
        distance: haversineDistance(location.latitude, location.longitude, state[6], state[5])
      }))
      .sort((a, b) => a.distance - b.distance) // Closest first
      .slice(0, 200); // Cap at 200 for performance

    flights = nearbyFlights;
    lastFetch = new Date();

    if (onFlightsUpdated) {
      onFlightsUpdated(flights);
    }

    console.log(`Flights updated: ${flights.length} aircraft within ${radiusKm}km`);

    return { flights, count: flights.length };
  } catch (error) {
    console.error('Failed to fetch flights:', error);
    return { flights, count: flights.length };
  }
}

export function getFlights() {
  return flights;
}

export function getFlightStats() {
  if (flights.length === 0) {
    return { count: 0, avgAltitude: 0, avgSpeed: 0 };
  }

  const altitudes = flights.map(f => f.altitude).filter(a => a > 0);
  const speeds = flights.map(f => f.velocity).filter(v => v > 0);

  return {
    count: flights.length,
    avgAltitude: altitudes.length > 0
      ? altitudes.reduce((a, b) => a + b, 0) / altitudes.length
      : 0,
    avgSpeed: speeds.length > 0
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : 0
  };
}

export function getLastFetchTime() {
  return lastFetch;
}

// Start periodic fetching
let fetchInterval = null;

export function startFetching() {
  if (fetchInterval) return;

  fetchFlights(); // Initial fetch
  fetchInterval = setInterval(fetchFlights, CONFIG.intervals.flights);
}

export function stopFetching() {
  if (fetchInterval) {
    clearInterval(fetchInterval);
    fetchInterval = null;
  }
}
