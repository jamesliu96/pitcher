import {
  autoCorrelate,
  getDataFromFrequency,
  meanAmplitude,
} from './pitcher.js';

const drawPixel = (
  { width, data }: ImageData,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number
) => {
  const idx = (x + y * width) * 4;
  data[idx + 0] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = a;
};

window.addEventListener('load', () => {
  const $volumeMeter = document.getElementById(
    'volume_meter'
  ) as HTMLMeterElement;
  const $frequency = document.getElementById('frequency') as HTMLSpanElement;
  const $nodeFrequency = document.getElementById(
    'node_frequency'
  ) as HTMLSpanElement;
  const $note = document.getElementById('note') as HTMLSpanElement;
  const $octave = document.getElementById('octave') as HTMLSpanElement;
  const $deviation = document.getElementById('deviation') as HTMLSpanElement;
  const WIDTH = 800;
  const HEIGHT = 100;
  const [w, h] = [WIDTH * devicePixelRatio, HEIGHT * devicePixelRatio];
  const $graphF = document.getElementById('graph_f') as HTMLCanvasElement;
  const $graphT = document.getElementById('graph_t') as HTMLCanvasElement;
  const $graphP = document.getElementById('graph_p') as HTMLCanvasElement;
  const $graphOF = document.getElementById(
    'graph_output_f'
  ) as HTMLCanvasElement;
  const $graphOT = document.getElementById(
    'graph_output_t'
  ) as HTMLCanvasElement;
  $graphF.width =
    $graphT.width =
    $graphP.width =
    $graphOF.width =
    $graphOT.width =
      w;
  $graphF.height = $graphT.height = $graphOF.height = $graphOT.height = h;
  $graphP.height = 4 * h;
  $graphF.style.width =
    $graphT.style.width =
    $graphP.style.width =
    $graphOF.style.width =
    $graphOT.style.width =
      `${WIDTH}px`;
  $graphF.style.height =
    $graphT.style.height =
    $graphOF.style.height =
    $graphOT.style.height =
      `${HEIGHT}px`;
  $graphP.style.height = `${4 * HEIGHT}px`;
  const ctxF = $graphF.getContext('2d');
  const ctxT = $graphT.getContext('2d');
  const ctxP = $graphP.getContext('2d');
  const ctxOF = $graphOF.getContext('2d');
  const ctxOT = $graphOT.getContext('2d');
  (async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      alert(error);
    }
    if (stream) {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const inputAnalyser = audioContext.createAnalyser();
      const outputAnalyser = audioContext.createAnalyser();
      [inputAnalyser, outputAnalyser].forEach((analyser) => {
        analyser.fftSize = 2048;
      });
      audioContext.createMediaStreamSource(stream).connect(inputAnalyser);
      oscillator.connect(outputAnalyser);
      outputAnalyser.connect(audioContext.destination);
      oscillator.start();
      const loop = () => {
        const buffer = new Float32Array(inputAnalyser.fftSize);
        inputAnalyser.getFloatTimeDomainData(buffer);
        const volume = meanAmplitude(buffer);
        $volumeMeter.value = volume;
        const frequency = autoCorrelate(buffer, audioContext.sampleRate);
        const { noteFrequency, note, octave, deviation } =
          getDataFromFrequency(frequency);
        const stable = volume >= 0.05 && frequency;
        if (stable) {
          $frequency.textContent = `${frequency.toFixed(2)} Hz`;
          $nodeFrequency.textContent = `${noteFrequency.toFixed(2)} Hz`;
          $note.textContent = note;
          $octave.textContent = `${octave}`;
          $deviation.textContent =
            deviation >= 1 ? '[+]' : deviation <= -1 ? '[-]' : '[*]';
          oscillator.frequency.value = noteFrequency;
        } else {
          oscillator.frequency.value = 0;
        }
        {
          const bytebuffer = new Uint8Array(inputAnalyser.fftSize);
          inputAnalyser.getByteTimeDomainData(bytebuffer);
          ctxF.clearRect(0, 0, w, h);
          const rects = [];
          for (let i = 0; i < w; i++) {
            const d = bytebuffer[~~((i / w) * bytebuffer.length)];
            const dRate = d / 255;
            const [x, y] = [i, dRate * h];
            rects.push({ x, y });
          }
          ctxF.strokeStyle = 'white';
          ctxF.lineJoin = 'round';
          ctxF.lineWidth = 1 * devicePixelRatio;
          ctxF.beginPath();
          rects.forEach(({ x, y }, i) => {
            if (i) ctxF.lineTo(x, y);
            else ctxF.moveTo(x, y);
          });
          ctxF.stroke();
        }
        {
          const bytebuffer = new Uint8Array(inputAnalyser.frequencyBinCount);
          inputAnalyser.getByteFrequencyData(bytebuffer);
          ctxT.clearRect(0, 0, w, h);
          const sli = ctxP.createImageData(w, 1);
          const rects = [];
          for (let i = 0; i < w; i++) {
            const d = bytebuffer[~~((i / w) * bytebuffer.length)];
            const dRate = d / 255;
            const [x, y] = [i, dRate * h];
            rects.push({ x, y });
            drawPixel(sli, i, 0, 255, 255, 0, d);
          }
          ctxT.strokeStyle = 'white';
          ctxT.lineJoin = 'round';
          ctxT.lineWidth = 1 * devicePixelRatio;
          ctxT.beginPath();
          rects.forEach(({ x, y }, i) => {
            if (i) ctxT.lineTo(x, y);
            else ctxT.moveTo(x, y);
          });
          ctxT.stroke();
          if (stable) {
            ctxT.strokeStyle = 'yellow';
            ctxT.lineWidth = 3 * devicePixelRatio;
            ctxT.beginPath();
            const x = (frequency / (audioContext.sampleRate / 2)) * w;
            ctxT.moveTo(x, 0);
            ctxT.lineTo(x, h);
            ctxT.stroke();
          }
          ctxP.putImageData(ctxP.getImageData(0, 0, w, 4 * h), 0, 1);
          ctxP.putImageData(sli, 0, 0);
        }
        {
          const bytebuffer = new Uint8Array(outputAnalyser.fftSize);
          outputAnalyser.getByteTimeDomainData(bytebuffer);
          ctxOF.clearRect(0, 0, w, h);
          const rects = [];
          for (let i = 0; i < w; i++) {
            const d = bytebuffer[~~((i / w) * bytebuffer.length)];
            const dRate = d / 255;
            const [x, y] = [i, dRate * h];
            rects.push({ x, y });
          }
          ctxOF.strokeStyle = 'white';
          ctxOF.lineJoin = 'round';
          ctxOF.lineWidth = 1 * devicePixelRatio;
          ctxOF.beginPath();
          rects.forEach(({ x, y }, i) => {
            if (i) ctxOF.lineTo(x, y);
            else ctxOF.moveTo(x, y);
          });
          ctxOF.stroke();
        }
        {
          const bytebuffer = new Uint8Array(outputAnalyser.frequencyBinCount);
          outputAnalyser.getByteFrequencyData(bytebuffer);
          ctxOT.clearRect(0, 0, w, h);
          const rects = [];
          for (let i = 0; i < w; i++) {
            const d = bytebuffer[~~((i / w) * bytebuffer.length)];
            const dRate = d / 255;
            const [x, y] = [i, dRate * h];
            rects.push({ x, y });
          }
          ctxOT.strokeStyle = 'white';
          ctxOT.lineJoin = 'round';
          ctxOT.lineWidth = 1 * devicePixelRatio;
          ctxOT.beginPath();
          rects.forEach(({ x, y }, i) => {
            if (i) ctxOT.lineTo(x, y);
            else ctxOT.moveTo(x, y);
          });
          ctxOT.stroke();
          if (stable) {
            ctxOT.strokeStyle = 'yellow';
            ctxOT.lineWidth = 3 * devicePixelRatio;
            ctxOT.beginPath();
            const x = (noteFrequency / (audioContext.sampleRate / 2)) * w;
            ctxOT.moveTo(x, 0);
            ctxOT.lineTo(x, h);
            ctxOT.stroke();
          }
        }
        requestAnimationFrame(loop);
      };
      loop();
    }
  })();
});
