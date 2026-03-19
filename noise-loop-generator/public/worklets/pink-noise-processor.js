class PinkNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.b = [0, 0, 0, 0, 0, 0, 0];
  }
  process(inputs, outputs) {
    const output = outputs[0][0];
    for (let i = 0; i < output.length; i++) {
      const white = Math.random() * 2 - 1;
      this.b[0] = 0.99886 * this.b[0] + white * 0.0555179;
      this.b[1] = 0.99332 * this.b[1] + white * 0.0750759;
      this.b[2] = 0.96900 * this.b[2] + white * 0.1538520;
      this.b[3] = 0.86650 * this.b[3] + white * 0.3104856;
      this.b[4] = 0.55000 * this.b[4] + white * 0.5329522;
      this.b[5] = -0.7616 * this.b[5] - white * 0.0168980;
      output[i] = (this.b[0] + this.b[1] + this.b[2] + this.b[3] + this.b[4] + this.b[5] + this.b[6] + white * 0.5362) / 10;
      this.b[6] = white * 0.115926;
    }
    return true;
  }
}
registerProcessor('pink-noise-processor', PinkNoiseProcessor);
