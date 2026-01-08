// Master audio engine - handles the master chain and coordinates layers
import * as Tone from 'tone';
import { CONFIG } from '../config.js';

let masterChain = null;

export function initMasterChain() {
  const { master } = CONFIG.audio;

  // Master reverb
  const reverb = new Tone.Reverb({
    decay: master.reverbDecay,
    wet: master.reverbWet,
    preDelay: 0.2
  }).toDestination();

  // Compressor
  const compressor = new Tone.Compressor({
    threshold: master.compressorThreshold,
    ratio: 3,
    attack: 0.1,
    release: 0.4
  }).connect(reverb);

  // Limiter
  const limiter = new Tone.Limiter(master.limiterThreshold).connect(compressor);

  masterChain = {
    reverb,
    compressor,
    limiter,
    // Layers connect to this
    input: limiter
  };

  return masterChain;
}

export function getMasterInput() {
  if (!masterChain) {
    throw new Error('Master chain not initialized. Call initMasterChain() first.');
  }
  return masterChain.input;
}

export function getMasterChain() {
  return masterChain;
}

// Mute/unmute for tab visibility
export function setMasterMute(muted) {
  if (muted) {
    Tone.getDestination().volume.rampTo(-Infinity, 0.5);
  } else {
    Tone.getDestination().volume.rampTo(0, 0.5);
  }
}

// Start the audio context (requires user interaction)
export async function startAudio() {
  await Tone.start();
  console.log('Audio context started');
  return true;
}
