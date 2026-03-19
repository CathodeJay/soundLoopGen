class BrownNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastOut = 0;
  }
  process(inputs, outputs) {
    const output = outputs[0][0];
    for (let i = 0; i < output.length; i++) {
      const white = Math.random() * 2 - 1;
      this.lastOut = (this.lastOut * 0.998 + white * 0.02);
      output[i] = this.lastOut * 3.5;
    }
    return true;
  }
}
registerProcessor('brown-noise-processor', BrownNoiseProcessor);
