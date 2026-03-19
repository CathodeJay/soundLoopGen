class WhiteNoiseProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const output = outputs[0][0];
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return true; // CRITICAL: must return true to keep processor alive
  }
}
registerProcessor('white-noise-processor', WhiteNoiseProcessor);
