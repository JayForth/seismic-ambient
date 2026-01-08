// Earthquake audio layer - spawns voices for seismic events
import * as Tone from 'tone';
import { CONFIG } from '../config.js';
import { getMasterInput } from './engine.js';
import { getUserLocation } from '../config.js';

let earthquakeAudio = null;
const activeVoices = new Map();

export function initEarthquakeLayer() {
  const masterInput = getMasterInput();
  const { earthquakes: config } = CONFIG.audio;

  // FM synth for harmonic richness
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5,
    modulationIndex: 0.8,
    oscillator: { type: 'sine' },
    modulation: { type: 'triangle' },
    envelope: {
      attack: 4,
      decay: 3,
      sustain: 0.5,
      release: 12
    },
    modulationEnvelope: {
      attack: 3,
      decay: 2,
      sustain: 0.4,
      release: 10
    },
    volume: -14
  });

  // Per-layer reverb (longer for distance feel)
  const reverb = new Tone.Reverb({
    decay: 15,
    wet: 0.5
  }).connect(masterInput);

  // Filter for warmth
  const filter = new Tone.Filter({
    frequency: 2000,
    type: 'lowpass',
    rolloff: -12
  }).connect(reverb);

  // Panner for spatial positioning
  const panner = new Tone.Panner(0).connect(filter);

  // Vibrato for evolution
  const vibrato = new Tone.Vibrato({
    frequency: 0.2,
    depth: 0.05
  }).connect(panner);

  synth.connect(vibrato);

  earthquakeAudio = {
    synth,
    reverb,
    filter,
    panner,
    vibrato
  };

  return earthquakeAudio;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function depthToPitch(depth) {
  const { earthquakes: config } = CONFIG.audio;
  const clampedDepth = Math.min(depth || 10, 700);
  const normalizedDepth = clampedDepth / 700;

  const octaveOffset = Math.floor(normalizedDepth * 3);
  const scaleIndex = Math.floor((normalizedDepth * 8) % config.scale.length);
  const midiNote = config.baseNote + 24 - (octaveOffset * 12) + config.scale[scaleIndex];

  return {
    freq: midiToFreq(midiNote),
    note: Tone.Frequency(midiToFreq(midiNote)).toNote(),
    octave: 4 - octaveOffset
  };
}

function magnitudeToParams(mag) {
  const { earthquakes: config } = CONFIG.audio;
  const normalizedMag = Math.min((mag - 2.5) / 5.5, 1);

  return {
    volume: config.volumeRange.min + (normalizedMag * (config.volumeRange.max - config.volumeRange.min)),
    duration: config.durationRange.min + (normalizedMag * (config.durationRange.max - config.durationRange.min)),
    harmonicity: 1 + (normalizedMag * 2.5),
    filterFreq: 800 + (normalizedMag * 2000),
    vibratoDepth: 0.02 + (normalizedMag * 0.06)
  };
}

function distanceToSpatial(quakeLat, quakeLon) {
  const loc = getUserLocation();

  let lonDiff = quakeLon - loc.longitude;
  if (lonDiff > 180) lonDiff -= 360;
  if (lonDiff < -180) lonDiff += 360;

  const pan = Math.max(-0.9, Math.min(0.9, lonDiff / 120));
  const latDiff = quakeLat - loc.latitude;
  const distance = Math.sqrt(lonDiff * lonDiff + latDiff * latDiff);
  const normalizedDist = Math.min(distance / 150, 1);
  const reverbWet = 0.3 + (normalizedDist * 0.45);

  return { pan, reverbWet, distance: normalizedDist };
}

export function playEarthquakeVoice(quake) {
  const { earthquakes: config } = CONFIG.audio;

  if (!earthquakeAudio || activeVoices.size >= config.maxVoices) return null;
  if (activeVoices.has(quake.id)) return null;

  const { mag, place, time } = quake.properties;
  const [lon, lat, depth] = quake.geometry.coordinates;

  const pitch = depthToPitch(depth);
  const params = magnitudeToParams(mag);
  const spatial = distanceToSpatial(lat, lon);

  // Configure spatial
  earthquakeAudio.panner.pan.rampTo(spatial.pan, 1);
  earthquakeAudio.reverb.wet.rampTo(spatial.reverbWet, 2);
  earthquakeAudio.filter.frequency.rampTo(params.filterFreq, 3);
  earthquakeAudio.vibrato.depth.rampTo(params.vibratoDepth, 2);

  // Play
  earthquakeAudio.synth.triggerAttackRelease(
    pitch.note,
    params.duration,
    undefined,
    Tone.dbToGain(params.volume)
  );

  // Track voice
  const voiceData = {
    quake,
    startTime: Date.now(),
    duration: params.duration * 1000,
    pitch,
    params,
    spatial
  };
  activeVoices.set(quake.id, voiceData);

  // Schedule removal
  setTimeout(() => {
    activeVoices.delete(quake.id);
  }, params.duration * 1000);

  console.log(`Earthquake voice: M${mag.toFixed(1)} at ${place || 'unknown'}, note: ${pitch.note}`);

  return voiceData;
}

export function getActiveVoices() {
  return activeVoices;
}

export function getActiveVoiceCount() {
  return activeVoices.size;
}
