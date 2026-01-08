// Flight audio layer - granular shimmer from aircraft positions
import * as Tone from 'tone';
import { CONFIG } from '../config.js';
import { getMasterInput } from './engine.js';
import { getUserLocation } from '../config.js';

let flightAudio = null;
let currentFlightVoices = new Map();
let updateInterval = null;

export function initFlightLayer() {
  const masterInput = getMasterInput();
  const { flights: config } = CONFIG.audio;

  // Create a pool of simple synths for the shimmer effect
  // Using FM synths with high harmonicity for bell-like tones
  const synthPool = [];
  for (let i = 0; i < config.maxVoices; i++) {
    const synth = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 0.5,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: {
        attack: 0.5,
        decay: 0.3,
        sustain: 0.4,
        release: 2
      },
      modulationEnvelope: {
        attack: 0.3,
        decay: 0.2,
        sustain: 0.3,
        release: 1.5
      },
      volume: config.volume
    });
    synthPool.push(synth);
  }

  // Shared effects for flight layer
  const filter = new Tone.Filter({
    frequency: 3000,
    type: 'lowpass',
    rolloff: -12
  }).connect(masterInput);

  const chorus = new Tone.Chorus({
    frequency: 0.5,
    delayTime: 2.5,
    depth: 0.3,
    wet: 0.4
  }).connect(filter);

  // Subtle auto-pan for movement
  const autoPan = new Tone.AutoPanner({
    frequency: 0.1,
    depth: 0.2
  }).connect(chorus);
  autoPan.start();

  // Connect all synths to the effect chain
  synthPool.forEach(synth => synth.connect(autoPan));

  // LFO for filter movement (tied to overall activity)
  const filterLFO = new Tone.LFO({
    frequency: 0.08,
    min: 1500,
    max: 4000
  }).connect(filter.frequency);

  flightAudio = {
    synthPool,
    filter,
    chorus,
    autoPan,
    filterLFO,
    currentSynthIndex: 0
  };

  return flightAudio;
}

function altitudeToPitch(altitude) {
  const { flights: config } = CONFIG.audio;
  // Altitude in meters, typical cruise is ~10000m
  const normalized = Math.min(altitude / 13000, 1);
  return config.pitchRange.min + (normalized * (config.pitchRange.max - config.pitchRange.min));
}

function velocityToFilterMod(velocity) {
  // Velocity in m/s, typical cruise is ~250 m/s
  const normalized = Math.min(velocity / 300, 1);
  return 0.05 + (normalized * 0.15); // LFO frequency
}

function distanceToPan(flight) {
  const loc = getUserLocation();
  let lonDiff = flight.longitude - loc.longitude;
  if (lonDiff > 180) lonDiff -= 360;
  if (lonDiff < -180) lonDiff += 360;
  return Math.max(-0.8, Math.min(0.8, lonDiff / 60));
}

function distanceToVolume(distance, maxDistance) {
  // Closer = louder
  const normalized = 1 - Math.min(distance / maxDistance, 1);
  return -32 + (normalized * 10); // -32 to -22 dB
}

export function startFlightLayer() {
  if (!flightAudio) return;

  flightAudio.filterLFO.start();
  console.log('Flight layer started');
}

export function stopFlightLayer() {
  if (!flightAudio) return;

  flightAudio.filterLFO.stop();
  flightAudio.synthPool.forEach(synth => synth.triggerRelease());
  currentFlightVoices.clear();

  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

// Update flight sounds based on current flight data
export function updateFlightSounds(flights) {
  if (!flightAudio || flights.length === 0) return;

  const { flights: config } = CONFIG.audio;
  const now = Tone.now();

  // Take a subset of flights for audio (closest ones)
  const audioFlights = flights.slice(0, config.maxVoices);

  audioFlights.forEach((flight, index) => {
    const synth = flightAudio.synthPool[index];
    if (!synth) return;

    const pitch = altitudeToPitch(flight.altitude);
    const volume = distanceToVolume(flight.distance, config.radiusKm);

    // Only trigger if this is a "new" enough position or pitch changed significantly
    const existingVoice = currentFlightVoices.get(flight.icao24);
    const pitchChanged = !existingVoice || Math.abs(existingVoice.pitch - pitch) > 50;

    if (pitchChanged) {
      // Soft re-trigger
      synth.volume.rampTo(volume, 0.5);
      synth.triggerAttackRelease(pitch, 4, now + (index * 0.1));

      currentFlightVoices.set(flight.icao24, {
        pitch,
        volume,
        lastUpdate: Date.now()
      });
    }
  });

  // Clean up old voices
  const activeIcaos = new Set(audioFlights.map(f => f.icao24));
  for (const [icao, voice] of currentFlightVoices) {
    if (!activeIcaos.has(icao)) {
      currentFlightVoices.delete(icao);
    }
  }
}

// Called periodically to create ambient texture from flights
export function playFlightTexture(flights) {
  if (!flightAudio || flights.length === 0) return;

  const { flights: config } = CONFIG.audio;
  const now = Tone.now();

  // Pick random subset of flights to create texture
  const shuffled = [...flights].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(8, flights.length));

  selected.forEach((flight, i) => {
    const synthIndex = (flightAudio.currentSynthIndex + i) % flightAudio.synthPool.length;
    const synth = flightAudio.synthPool[synthIndex];

    const pitch = altitudeToPitch(flight.altitude);
    const volume = distanceToVolume(flight.distance, config.radiusKm);

    // Stagger the notes slightly for shimmer effect
    const startTime = now + (i * 0.3) + (Math.random() * 0.2);
    const duration = 2 + (Math.random() * 3);

    synth.volume.value = volume;
    synth.triggerAttackRelease(pitch, duration, startTime);
  });

  flightAudio.currentSynthIndex = (flightAudio.currentSynthIndex + selected.length) % flightAudio.synthPool.length;
}

// Start periodic texture generation
export function startFlightTexture(getFlights) {
  if (updateInterval) return;

  updateInterval = setInterval(() => {
    const flights = getFlights();
    if (flights.length > 0) {
      playFlightTexture(flights);
    }
  }, CONFIG.audio.flights.updateRate);
}

export function getFlightAudio() {
  return flightAudio;
}
