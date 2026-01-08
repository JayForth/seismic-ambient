// Drone layer - constant evolving pad that forms the foundation
import * as Tone from 'tone';
import { CONFIG } from '../config.js';
import { getMasterInput } from './engine.js';

let drone = null;

export function initDroneLayer() {
  const { drone: droneConfig } = CONFIG.audio;
  const masterInput = getMasterInput();

  // Primary drone synth - warm sine
  const synth1 = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: {
      attack: 6,
      decay: 3,
      sustain: 0.7,
      release: 10
    },
    volume: droneConfig.volume
  });

  // Secondary drone - adds thickness with triangle wave
  const synth2 = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 8,
      decay: 4,
      sustain: 0.5,
      release: 12
    },
    volume: droneConfig.volume - 6
  });

  // Filter for warmth control
  const filter = new Tone.Filter({
    frequency: 350,
    type: 'lowpass',
    rolloff: -24,
    Q: 1
  }).connect(masterInput);

  // Chorus for width
  const chorus = new Tone.Chorus({
    frequency: 0.3,
    delayTime: 3.5,
    depth: 0.4,
    wet: 0.3
  }).connect(filter);

  // Slow filter modulation
  const filterLFO = new Tone.LFO({
    frequency: 0.02,
    min: droneConfig.filterRange.min,
    max: droneConfig.filterRange.max
  }).connect(filter.frequency);

  // Connect synths
  synth1.connect(chorus);
  synth2.connect(chorus);

  drone = {
    synth1,
    synth2,
    filter,
    chorus,
    filterLFO,
    isPlaying: false
  };

  return drone;
}

export function startDrone() {
  if (!drone || drone.isPlaying) return;

  const { drone: droneConfig } = CONFIG.audio;

  // Start LFO
  drone.filterLFO.start();

  // Play spacious chord
  const notes1 = ['C2', 'G2'];
  const notes2 = ['C3', 'G3'];

  drone.synth1.triggerAttack(notes1);
  drone.synth2.triggerAttack(notes2);
  drone.isPlaying = true;

  console.log('Drone layer started');
}

export function stopDrone() {
  if (!drone || !drone.isPlaying) return;

  drone.synth1.releaseAll();
  drone.synth2.releaseAll();
  drone.filterLFO.stop();
  drone.isPlaying = false;
}

// Modulate drone based on global activity
export function modulateDrone(avgMagnitude, eventCount) {
  if (!drone) return;

  // Higher average magnitude = brighter filter
  const normalizedMag = Math.max(0, (avgMagnitude - 2.5) / 4.5);
  const brightness = 250 + (normalizedMag * 350);
  drone.filter.frequency.rampTo(brightness, 8);
}

export function getDrone() {
  return drone;
}
