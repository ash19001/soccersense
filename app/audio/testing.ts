/**
 * A fake Web Audio for tests (jsdom has none): every node is a plain object that remembers
 * what it was connected to, what was scheduled on its parameters, and whether it was
 * started, stopped and disconnected. Time only moves when the test says so (`advance`).
 * Used by the tests of app/audio and of the components that drive it; never by the app.
 */

export class FakeParam {
  readonly events: (readonly [string, ...number[]])[] = [];
  constructor(public value: number) {}
  setValueAtTime(value: number, time: number): this {
    this.events.push(["set", value, time]);
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push(["linear", value, time]);
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    if (!(value > 0)) throw new RangeError("exponential ramp to a value <= 0");
    this.events.push(["exponential", value, time]);
    return this;
  }
  setTargetAtTime(value: number, time: number, constant: number): this {
    if (!(constant > 0)) throw new RangeError("time constant <= 0");
    this.events.push(["target", value, time, constant]);
    return this;
  }
  cancelScheduledValues(time: number): this {
    this.events.push(["cancel", time]);
    return this;
  }
}

export class FakeNode {
  readonly outputs = new Set<FakeNode | FakeParam>();
  disconnected = false;
  constructor(readonly ctx: FakeAudioContext) {
    ctx.nodes.push(this);
  }
  connect<T extends FakeNode | FakeParam>(dest: T): T {
    if (this.ctx.closed) throw new Error("connect on a closed context");
    this.outputs.add(dest);
    return dest;
  }
  disconnect(): void {
    this.outputs.clear();
    this.disconnected = true;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

export class FakeFilter extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
  readonly gain = new FakeParam(0);
}

export class FakePanner extends FakeNode {
  readonly pan = new FakeParam(0);
}

export class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24);
  readonly knee = new FakeParam(30);
  readonly ratio = new FakeParam(12);
  readonly attack = new FakeParam(0.003);
  readonly release = new FakeParam(0.25);
}

export class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = "none";
}

export class FakeConvolver extends FakeNode {
  buffer: FakeBuffer | null = null;
}

export class FakeSource extends FakeNode {
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  stopCalls = 0;
  start(time = 0): void {
    if (this.startedAt !== null) throw new Error("started twice");
    this.startedAt = time;
  }
  stop(time?: number): void {
    if (this.startedAt === null) throw new Error("stopped before it started");
    this.stopCalls++;
    this.stoppedAt = time ?? this.ctx.currentTime;
  }
  /** Still making sound at the context's current time. */
  get playing(): boolean {
    return (
      this.startedAt !== null &&
      (this.stoppedAt === null || this.stoppedAt > this.ctx.currentTime)
    );
  }
}

export class FakeOscillator extends FakeSource {
  type = "sine";
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);
}

export class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  loop = false;
  readonly playbackRate = new FakeParam(1);
}

export class FakeBuffer {
  private readonly channels: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    );
  }
  get duration(): number {
    return this.length / this.sampleRate;
  }
  getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }
}

export class FakeAudioContext {
  /** Every context made, in order. */
  static made: FakeAudioContext[] = [];

  currentTime = 0;
  /** Low, so the noise buffers are quick to make. */
  readonly sampleRate = 8000;
  state: "suspended" | "running" | "closed" = "running";
  readonly nodes: FakeNode[] = [];
  readonly destination: FakeNode;
  resumes = 0;
  suspends = 0;
  closed = false;
  decoded = 0;

  constructor() {
    FakeAudioContext.made.push(this);
    this.destination = new FakeNode(this);
  }

  createGain(): FakeGain {
    return new FakeGain(this);
  }
  createBiquadFilter(): FakeFilter {
    return new FakeFilter(this);
  }
  createStereoPanner(): FakePanner {
    return new FakePanner(this);
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor(this);
  }
  createWaveShaper(): FakeShaper {
    return new FakeShaper(this);
  }
  createConvolver(): FakeConvolver {
    return new FakeConvolver(this);
  }
  createOscillator(): FakeOscillator {
    return new FakeOscillator(this);
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource(this);
  }
  createBuffer(channels: number, length: number, rate: number): FakeBuffer {
    return new FakeBuffer(channels, length, rate);
  }
  async decodeAudioData(bytes: ArrayBuffer): Promise<FakeBuffer> {
    this.decoded++;
    if (bytes.byteLength === 0) throw new Error("not audio");
    return new FakeBuffer(2, this.sampleRate, this.sampleRate);
  }
  async resume(): Promise<void> {
    this.resumes++;
    if (!this.closed) this.state = "running";
  }
  async suspend(): Promise<void> {
    this.suspends++;
    if (!this.closed) this.state = "suspended";
  }
  async close(): Promise<void> {
    this.closed = true;
    this.state = "closed";
  }

  /** Moves the clock on. */
  advance(seconds: number): void {
    this.currentTime += seconds;
  }

  /** Sources still sounding now. */
  playing(): FakeSource[] {
    return this.nodes.filter(
      (node): node is FakeSource => node instanceof FakeSource && node.playing,
    );
  }

  /** Nodes that are connected to something (the buses and the destination aside). */
  connected(): FakeNode[] {
    return this.nodes.filter((node) => node.outputs.size > 0);
  }

  /** As the engine expects it. */
  asContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}
