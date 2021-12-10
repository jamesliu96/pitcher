import { autoCorrelate, getDataFromFrequency } from './pitcher.js';

window.addEventListener('load', () => {
  const $volumeMeter = document.getElementById(
    'volume_meter'
  ) as HTMLMeterElement;
  const $frequency = document.getElementById('frequency') as HTMLDivElement;
  const $nodeFrequency = document.getElementById(
    'node_frequency'
  ) as HTMLDivElement;
  const $note = document.getElementById('note') as HTMLSpanElement;
  const $octave = document.getElementById('octave') as HTMLSpanElement;
  const $deviation = document.getElementById('deviation') as HTMLSpanElement;

  const WIDTH = 400;
  const HEIGHT = 100;
  const $graphF = document.getElementById('graph_f') as HTMLCanvasElement;
  const $graphT = document.getElementById('graph_t') as HTMLCanvasElement;
  $graphF.width = $graphT.width = WIDTH * devicePixelRatio;
  $graphF.height = $graphT.height = HEIGHT * devicePixelRatio;
  $graphF.style.width = $graphT.style.width = `${WIDTH}px`;
  $graphF.style.height = $graphT.style.height = `${HEIGHT}px`;
  const ctxF = $graphF.getContext('2d');
  const ctxT = $graphT.getContext('2d');

  (async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      alert(error);
    }
    if (stream) {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const update = ({
        frequency,
        note,
        noteFrequency,
        deviation,
        octave,
      }: ReturnType<typeof getDataFromFrequency>) => {
        $frequency.textContent = `${frequency.toFixed(2)} Hz`;
        $nodeFrequency.textContent = `${noteFrequency.toFixed(2)} Hz`;
        $note.textContent = note;
        $octave.textContent = `${octave}`;
        $deviation.textContent =
          deviation >= 1 ? '⬆' : deviation <= -1 ? '⬇' : '-';
      };
      const oscillator = audioContext.createOscillator();
      oscillator.connect(audioContext.destination);
      oscillator.start();
      const loop = () => {
        const f32buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(f32buffer);
        let sum = 0.0;
        for (const amplitude of f32buffer) sum += amplitude ** 2;
        const volume = Math.sqrt(sum / f32buffer.length);
        $volumeMeter.value = volume;
        if (volume >= 0.05) {
          const frequency = autoCorrelate(f32buffer, audioContext.sampleRate);
          if (frequency) {
            const data = getDataFromFrequency(frequency);
            update(data);
            oscillator.frequency.value = data.noteFrequency;
          } else {
            oscillator.frequency.value = 0;
          }
        } else {
          oscillator.frequency.value = 0;
        }
        {
          const bytebuffer = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(bytebuffer);
          ctxF.clearRect(
            0,
            0,
            WIDTH * devicePixelRatio,
            HEIGHT * devicePixelRatio
          );
          const rects = [];
          for (let i = 0; i < WIDTH * devicePixelRatio; i++) {
            const d =
              bytebuffer[
                ~~((i / (WIDTH * devicePixelRatio)) * bytebuffer.length)
              ];
            const dRate = d / 255;
            const [x, y] = [i, dRate * HEIGHT * devicePixelRatio];
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
          const bytebuffer = new Uint8Array(analyser.fftSize);
          analyser.getByteFrequencyData(bytebuffer);
          ctxT.clearRect(
            0,
            0,
            WIDTH * devicePixelRatio,
            HEIGHT * devicePixelRatio
          );
          const rects = [];
          for (let i = 0; i < WIDTH * devicePixelRatio; i++) {
            const d =
              bytebuffer[
                ~~((i / (WIDTH * devicePixelRatio)) * bytebuffer.length)
              ];
            const dRate = d / 255;
            const [x, y] = [
              i * devicePixelRatio,
              dRate * HEIGHT * devicePixelRatio,
            ];
            rects.push({ x, y });
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
        }
        requestAnimationFrame(loop);
      };
      loop();
    }
  })();
});
