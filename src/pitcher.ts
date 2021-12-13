const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const A440 = 440;
const MIDI = 69;
const A = 2 ** (1 / 12);
const C0 = 16.35;

export const getDataFromFrequency = (frequency: number) => {
  const N = Math.round(12 * Math.log2(frequency / A440));
  const noteFrequency = A440 * A ** N;
  const octave = Math.floor(Math.log2(noteFrequency / C0));

  return {
    frequency,
    noteFrequency,
    note: NOTES[(N + MIDI) % NOTES.length],
    deviation: frequency - noteFrequency,
    octave,
  };
};

export const autoCorrelate = (buffer: Float32Array, sampleRate: number) => {
  const RMS = Math.sqrt(
    buffer.reduce((acc, el) => acc + el ** 2, 0) / buffer.length
  );
  if (RMS < 0.001) return NaN;

  const THRES = 0.2;
  let r1 = 0;
  let r2 = buffer.length - 1;
  for (let i = 0; i < buffer.length / 2; ++i) {
    if (Math.abs(buffer[i]) < THRES) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < buffer.length / 2; ++i) {
    if (Math.abs(buffer[buffer.length - i]) < THRES) {
      r2 = buffer.length - i;
      break;
    }
  }

  const buf2 = buffer.slice(r1, r2);
  const c = new Array(buf2.length).fill(0);
  for (let i = 0; i < buf2.length; ++i) {
    for (let j = 0; j < buf2.length - i; ++j) {
      c[i] = c[i] + buf2[j] * buf2[j + i];
    }
  }

  let d = 0;
  for (; c[d] > c[d + 1]; ++d);

  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < buf2.length; ++i) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  const T0 = maxpos;

  const x1 = c[T0 - 1];
  const x2 = c[T0];
  const x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;

  return sampleRate / (a ? T0 - b / (2 * a) : T0);
};

export const meanAmplitude = (buffer: Float32Array) => {
  let sum = 0;
  for (const amplitude of buffer) sum += amplitude ** 2;
  return Math.sqrt(sum / buffer.length);
};
