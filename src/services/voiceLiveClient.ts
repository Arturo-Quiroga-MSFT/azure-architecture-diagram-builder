// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Browser side of the Voice Live beta. Audio goes through the app's own
// /api/voice-live relay (the token server holds the managed identity and owns
// the session configuration); the browser only streams microphone audio and
// plays the spoken replies.

import { trackEvent } from './telemetryService';

export type VoiceLiveStatus = 'idle' | 'connecting' | 'listening' | 'speaking';

export interface VoiceLiveCallbacks {
  onStatus: (status: VoiceLiveStatus) => void;
  onUserTranscript: (text: string) => void;
  onAssistantTranscript: (text: string) => void;
  onError: (message: string) => void;
  /** Every tool call Ava makes (server- or browser-side), for display. */
  onToolActivity?: (name: string, args: Record<string, unknown>) => void;
  /** Runs a browser-side tool and resolves with its JSON result. */
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/** Tools the relay expects the browser to execute (it owns the canvas). */
export const BROWSER_TOOLS = new Set(['draw_architecture', 'describe_canvas']);

export const isVoiceLiveEnabled = (): boolean =>
  String(import.meta.env.VITE_ENABLE_VOICE_LIVE || '').toLowerCase() === 'true';

const TARGET_RATE = 24000;
const FRAME_SAMPLES = 1200; // 50 ms of 24 kHz pcm16

// Downsamples the device rate to 24 kHz mono and posts 50 ms Int16 frames.
const CAPTURE_WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.ratio = sampleRate / ${TARGET_RATE}; this.pos = 0; this.frame = new Int16Array(${FRAME_SAMPLES}); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    while (this.pos < ch.length) {
      const i = Math.floor(this.pos), f = this.pos - i;
      const a = ch[i], b = i + 1 < ch.length ? ch[i + 1] : a;
      const s = Math.max(-1, Math.min(1, a + (b - a) * f));
      this.frame[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.frame.length) { this.port.postMessage(this.frame.buffer.slice(0)); this.n = 0; }
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64Pcm16(b64: string): Float32Array<ArrayBuffer> {
  const binary = atob(b64);
  const samples = new Float32Array(new ArrayBuffer((binary.length >> 1) * 4));
  for (let i = 0; i < samples.length; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    const v = (hi << 8) | lo;
    samples[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
  }
  return samples;
}

export class VoiceLiveSession {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private worklet: AudioWorkletNode | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private playhead = 0;
  private responseDone = true;
  private stopped = false;
  private startedAt = 0;
  private turns = 0;

  constructor(private readonly cb: VoiceLiveCallbacks) {}

  async start(): Promise<void> {
    this.cb.onStatus('connecting');
    this.startedAt = Date.now();
    try {
      // Ask for the microphone first so a denied prompt fails before any session starts.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.ctx = new AudioContext();
      const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: 'application/javascript' }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      this.fail(err?.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow it in the browser and try again.'
        : `Could not start the microphone: ${err?.message || err}`);
      return;
    }
    if (this.stopped) return;

    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${scheme}://${window.location.host}/api/voice-live`);
    this.ws = ws;
    ws.onmessage = (msg) => this.onServerEvent(msg.data);
    ws.onclose = (ev) => {
      if (this.stopped) return;
      this.fail(ev.code === 4000 ? 'Voice session time limit reached.' : (ev.reason || 'The voice session ended.'));
    };
    ws.onerror = () => { /* onclose reports the failure */ };
    trackEvent('VoiceLive_Started');
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.stopPlayback();
    this.worklet?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => undefined);
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close(1000, 'user stopped');
    trackEvent('VoiceLive_Ended', undefined, {
      durationSec: Math.round((Date.now() - this.startedAt) / 1000),
      turns: this.turns,
    });
    this.cb.onStatus('idle');
  }

  private fail(message: string): void {
    this.cb.onError(message);
    this.stop();
  }

  private startCapture(): void {
    if (!this.ctx || !this.stream || this.worklet) return;
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.ctx, 'pcm-capture');
    this.worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(e.data) }));
      }
    };
    source.connect(this.worklet);
    void this.ctx.resume();
    this.cb.onStatus('listening');
  }

  private onServerEvent(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let ev: any;
    try { ev = JSON.parse(raw); } catch { return; }
    switch (ev.type) {
      case 'session.updated':
        this.startCapture();
        break;
      case 'input_audio_buffer.speech_started':
        // Barge-in: the user talked over the reply, so drop what's still queued.
        this.stopPlayback();
        this.cb.onStatus('listening');
        break;
      case 'response.created':
        this.responseDone = false;
        break;
      case 'response.audio.delta':
        this.enqueue(ev.delta);
        break;
      case 'response.done':
        this.responseDone = true;
        this.turns += 1;
        if (this.playing.size === 0) this.cb.onStatus('listening');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (ev.transcript?.trim()) this.cb.onUserTranscript(ev.transcript.trim());
        break;
      case 'response.audio_transcript.done':
        if (ev.transcript?.trim()) this.cb.onAssistantTranscript(ev.transcript.trim());
        break;
      case 'response.function_call_arguments.done':
        void this.handleToolCall(ev);
        break;
      case 'error':
        // A queued response.create racing an active reply is harmless; don't surface it.
        if (!/active response/i.test(ev.error?.message || '')) {
          this.cb.onError(ev.error?.message || 'Voice service error');
        }
        break;
      default:
        break;
    }
  }

  private async handleToolCall(ev: any): Promise<void> {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(ev.arguments || '{}'); } catch { /* keep empty */ }
    this.cb.onToolActivity?.(ev.name, args);
    trackEvent('VoiceLive_ToolCall', { tool: String(ev.name) });
    if (!BROWSER_TOOLS.has(ev.name) || !ev.call_id) return;
    let result: unknown;
    try {
      result = this.cb.onToolCall ? await this.cb.onToolCall(ev.name, args) : { error: 'Tool not available' };
    } catch (err: any) {
      result = { error: err?.message || String(err) };
    }
    if (this.stopped || this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'tool.result', call_id: ev.call_id, output: JSON.stringify(result ?? {}) }));
  }

  private enqueue(b64: string): void {
    if (!this.ctx || !b64) return;
    const samples = fromBase64Pcm16(b64);
    if (!samples.length) return;
    const buffer = this.ctx.createBuffer(1, samples.length, TARGET_RATE);
    buffer.copyToChannel(samples, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.02, this.playhead);
    src.start(at);
    this.playhead = at + buffer.duration;
    this.playing.add(src);
    this.cb.onStatus('speaking');
    src.onended = () => {
      this.playing.delete(src);
      if (this.playing.size === 0 && this.responseDone && !this.stopped) this.cb.onStatus('listening');
    };
  }

  private stopPlayback(): void {
    this.playing.forEach((src) => {
      src.onended = null;
      try { src.stop(); } catch { /* already stopped */ }
    });
    this.playing.clear();
    this.playhead = 0;
  }
}
