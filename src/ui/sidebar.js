// Sidebar UI module
import { CONFIG } from '../config.js';
import { getActiveVoices } from '../audio/earthquakeLayer.js';

let statsElements = {};
let eventListElement = null;
let waveformElement = null;
let statusElements = {};

export function initSidebar() {
  // Cache DOM elements
  statsElements = {
    earthquakeCount: document.getElementById('stat-eq-count'),
    avgMagnitude: document.getElementById('stat-avg-mag'),
    maxMagnitude: document.getElementById('stat-max-mag'),
    activeVoices: document.getElementById('stat-voices'),
    flightCount: document.getElementById('stat-flight-count')
  };

  eventListElement = document.getElementById('event-list');
  waveformElement = document.getElementById('waveform');
  statusElements = {
    dot: document.querySelector('.status-dot'),
    text: document.getElementById('status-text'),
    lastUpdate: document.getElementById('last-update')
  };

  // Initialize waveform bars
  initWaveform();
}

function initWaveform() {
  if (!waveformElement) return;

  for (let i = 0; i < CONFIG.visual.waveformBars; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    waveformElement.appendChild(bar);
  }
}

export function updateStats(earthquakeStats, flightStats) {
  if (statsElements.earthquakeCount) {
    statsElements.earthquakeCount.textContent = earthquakeStats.count || '--';
  }
  if (statsElements.avgMagnitude) {
    statsElements.avgMagnitude.textContent = earthquakeStats.avgMag
      ? earthquakeStats.avgMag.toFixed(2)
      : '--';
  }
  if (statsElements.maxMagnitude) {
    statsElements.maxMagnitude.textContent = earthquakeStats.maxMag
      ? `M${earthquakeStats.maxMag.toFixed(1)}`
      : '--';
  }
  if (statsElements.flightCount) {
    statsElements.flightCount.textContent = flightStats.count || '--';
  }
}

export function updateActiveVoicesCount(count) {
  if (statsElements.activeVoices) {
    statsElements.activeVoices.textContent = count;
  }
}

export function updateEventList() {
  if (!eventListElement) return;

  const activeVoices = getActiveVoices();

  if (activeVoices.size === 0) {
    eventListElement.innerHTML = '<div class="empty-state">Waiting for seismic activity...</div>';
    return;
  }

  eventListElement.innerHTML = '';

  // Sort by magnitude descending
  const sorted = Array.from(activeVoices.values())
    .sort((a, b) => b.quake.properties.mag - a.quake.properties.mag);

  for (const voice of sorted) {
    const { quake, startTime, duration, pitch, spatial } = voice;
    const { mag, place, time } = quake.properties;
    const [lon, lat, depth] = quake.geometry.coordinates;

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, (duration - elapsed) / 1000);
    const isMajor = mag >= CONFIG.audio.earthquakes.majorThreshold;
    const isNew = elapsed < 8000;

    const timeAgo = formatTimeAgo(new Date(time));

    const item = document.createElement('div');
    item.className = 'event-item' + (isNew ? ' new' : '') + (isMajor ? ' major' : '');

    item.innerHTML = `
      <div class="event-header">
        <span class="event-magnitude${isMajor ? ' major' : ''}">M${mag.toFixed(1)}</span>
        <span class="event-time">${timeAgo}</span>
      </div>
      <div class="event-location">${place || 'Unknown location'}</div>
      <div class="event-details">
        <span>Depth: ${(depth || 0).toFixed(1)} km</span>
        <span>Coords: ${lat.toFixed(2)}, ${lon.toFixed(2)}</span>
      </div>
      <div class="event-sound">
        <div class="event-sound-label">Sound</div>
        <div class="event-sound-info">
          <span class="sound-param">Note: ${pitch.note}</span>
          <span class="sound-param">Pan: ${spatial.pan > 0 ? 'R' : 'L'}${Math.abs(spatial.pan * 100).toFixed(0)}%</span>
          <span class="sound-param">${formatDuration(remaining)}</span>
        </div>
      </div>
    `;

    eventListElement.appendChild(item);
  }
}

function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')} left`;
}

export function updateWaveform(voiceCount, maxVoices) {
  const bars = waveformElement?.querySelectorAll('.waveform-bar');
  if (!bars) return;

  const time = Date.now() / 1000;

  bars.forEach((bar, i) => {
    const wave1 = Math.sin(time * 0.5 + i * 0.15) * 0.3;
    const wave2 = Math.sin(time * 0.8 + i * 0.1) * 0.2;
    const wave3 = Math.sin(time * 1.3 + i * 0.2) * 0.1;

    const activity = (voiceCount / maxVoices) * 0.4;
    const noise = Math.random() * 0.15;

    const height = Math.max(2, (0.3 + wave1 + wave2 + wave3 + activity + noise) * 35);
    bar.style.height = `${height}px`;
  });
}

export function updateStatus(text, isActive) {
  if (statusElements.text) {
    statusElements.text.textContent = text;
  }
  if (statusElements.dot) {
    statusElements.dot.classList.toggle('active', isActive);
  }
}

export function updateLastFetchTime(time) {
  if (statusElements.lastUpdate && time) {
    statusElements.lastUpdate.textContent = `Updated ${time.toLocaleTimeString()}`;
  }
}
