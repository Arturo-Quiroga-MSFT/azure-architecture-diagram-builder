// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * AvatarPresenter — wraps the Azure TTS Avatar JS SDK for the "Present Critique"
 * feature in CompareModelsModal. The avatar session runs entirely client-side via
 * WebRTC.
 *
 * Auth: keyless — the token server uses DefaultAzureCredential to acquire an
 * AAD token, then exchanges it for a short-lived Speech STS token via the
 * resource-specific endpoint (https://{resource}.cognitiveservices.azure.com/sts/...).
 * The STS token is passed to fromAuthorizationToken. No API key in the browser.
 *
 * Usage:
 *   const presenter = new AvatarPresenter({ onStatus, onError });
 *   await presenter.connect(videoEl, audioEl);
 *   await presenter.speak(text);
 *   presenter.stopSpeaking();
 *   presenter.disconnect();
 */

export type AvatarStatus = 'idle' | 'connecting' | 'ready' | 'speaking' | 'error';

export interface AvatarPresenterOptions {
  character?: string;
  style?: string;
  voice?: string;
  onStatus?: (status: AvatarStatus) => void;
  onError?: (message: string) => void;
  /** Called with the word index (0-based) as each word begins to be spoken. */
  onWord?: (wordIndex: number) => void;
  /** Called with the SSML <bookmark mark="..."/> name when reached. */
  onBookmark?: (name: string) => void;
}

/** Grace period after playback starts before the first utterance is requested. */
const AUDIO_PRIME_MS = 400;
/** Upper bound on waiting for a media element to begin rendering. */
const MEDIA_PLAYBACK_TIMEOUT_MS = 8_000;
/** Slack added to the estimated speaking time before abandoning the TurnEnd wait. */
const TURN_END_SLACK_MS = 20_000;
/** Speech SDK offsets use 100-nanosecond ticks. */
const TICKS_PER_SECOND = 10_000_000;
const MEDIA_CLOCK_TOLERANCE_SECONDS = 0.05;

/** Rough upper bound on how long `text` takes to speak, used only as a stall guard. */
function estimatePlaybackMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return (words / 2) * 1000 + TURN_END_SLACK_MS;
}

/** Resolve once the element is actually rendering media, or when the wait times out. */
function waitUntilPlaying(el: HTMLMediaElement, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!el.paused && el.readyState >= 3 && el.currentTime > 0) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener('playing', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    el.addEventListener('playing', finish);
  });
}

export class AvatarPresenter {
  private synthesizer: any = null;
  private peerConnection: RTCPeerConnection | null = null;
  private videoStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private options: Required<AvatarPresenterOptions>;
  private pendingTurnEnd: (() => void) | null = null;
  private speechStartOffsetTicks: number | null = null;
  private speechDurationTicks: number | null = null;
  private turnEndOffsetTicks: number | null = null;
  private playbackWaitGeneration = 0;

  /** Warm the lazily-imported Speech SDK chunk so connect() is not gated on its download. */
  static preload(): void {
    void import('microsoft-cognitiveservices-speech-sdk').catch(() => { /* best effort */ });
  }

  constructor(options: AvatarPresenterOptions = {}) {
    this.options = {
      character: options.character ?? 'lisa',
      style: options.style ?? 'casual-sitting',
      voice: options.voice ?? 'en-US-AvaMultilingualNeural',
      onStatus: options.onStatus ?? (() => {}),
      onError: options.onError ?? (() => {}),
      onWord: options.onWord ?? (() => {}),
      onBookmark: options.onBookmark ?? (() => {}),
    };
  }

  /**
   * Establish a WebRTC avatar session. Attaches the video/audio streams to the
   * provided media elements once the connection is ready.
   */
  async connect(videoEl: HTMLVideoElement, audioEl: HTMLAudioElement): Promise<void> {
    this.options.onStatus('connecting');
    this.videoStream = new MediaStream();
    this.audioStream = new MediaStream();
    this.audioElement = audioEl;

    const forceTcp = (typeof window !== 'undefined' && (window as any).__AVATAR_FORCE_TCP__ !== false);

    // These three are independent; running them concurrently removes two full
    // round trips from the perceived start-up delay.
    const [SpeechSDK, { token, region }, iceServers] = await Promise.all([
      import('microsoft-cognitiveservices-speech-sdk'),
      this.fetchSpeechToken(),
      this.fetchIceServers(forceTcp),
    ]);

    // Must use fromEndpoint + set authorizationToken — fromAuthorizationToken does not
    // accept the aad# format required for Entra ID auth (WebSocket 1006 error otherwise)
    const wssUrl = new URL(`wss://${region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?enableTalkingAvatar=true`);
    const speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(wssUrl);
    speechConfig.authorizationToken = token;
    speechConfig.speechSynthesisVoiceName = this.options.voice;

    const avatarConfig = new SpeechSDK.AvatarConfig(
      this.options.character,
      this.options.style,
      new SpeechSDK.AvatarVideoFormat(),
    );

    // Pass ICE relay servers to the avatar config (required by the SDK)
    if (iceServers.length > 0) {
      (avatarConfig as any).remoteIceServers = iceServers;
    }

    // Create the peer connection. 'relay' (when forceTcp) ensures all media goes
    // through the TURN server, avoiding host/srflx candidates that get filtered.
    this.peerConnection = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: forceTcp ? 'relay' : 'all',
    });

    // Add sendrecv transceivers so Azure can deliver the video/audio tracks
    this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.muted = true;
    audioEl.autoplay = true;

    const playMedia = (element: HTMLMediaElement) => {
      element.play().catch((err) => {
        console.warn(`[avatar] ${element.tagName.toLowerCase()}.play() rejected:`, err);
      });
    };

    // Mirror Microsoft's reference TTS Avatar sample: prefer event.streams[0]
    // (the SDK always populates it for the avatar service) and fall back to a
    // synthesized MediaStream only when the implementation omits it.
    this.peerConnection.ontrack = (event: RTCTrackEvent) => {
      const stream = event.streams[0] ?? (() => {
        const s = new MediaStream();
        s.addTrack(event.track);
        return s;
      })();

      if (event.track.kind === 'video') {
        this.videoStream = stream;
        videoEl.srcObject = stream;
        const tryPlay = () => playMedia(videoEl);
        videoEl.onloadedmetadata = tryPlay;
        videoEl.onloadeddata = tryPlay;
        event.track.onunmute = () => playMedia(videoEl);
        playMedia(videoEl);
      } else if (event.track.kind === 'audio') {
        this.audioStream = stream;
        audioEl.srcObject = stream;
        audioEl.onloadedmetadata = () => playMedia(audioEl);
        event.track.onunmute = () => playMedia(audioEl);
        playMedia(audioEl);
      }
    };

    this.synthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);

    this.synthesizer.avatarEventReceived = (_s: any, e: any) => {
      if (e.description === 'SwitchToSpeaking') {
        if (this.pendingTurnEnd) this.speechStartOffsetTicks = e.offset;
        this.options.onStatus('speaking');
      } else if (e.description === 'TurnEnd') {
        this.turnEndOffsetTicks = e.offset;
        this.scheduleTurnEndResolution();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      if (state === 'failed') {
        this.options.onError('WebRTC ICE connection failed. Check network/firewall.');
        this.options.onStatus('error');
      }
    };

    // Wrap startAvatarAsync with a 30s timeout — it can hang silently on network issues
    const timeoutMs = 30_000;
    const result = await Promise.race([
      this.synthesizer.startAvatarAsync(this.peerConnection),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Avatar connection timed out after ${timeoutMs / 1000}s`)), timeoutMs),
      ),
    ]);

    if (result.reason !== SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
      const detail = result.errorDetails ?? 'Unknown error';
      this.options.onStatus('error');
      this.options.onError(`Avatar failed to start: ${detail}`);
      this.disconnect();
      throw new Error(detail);
    }

    playMedia(videoEl);
    playMedia(audioEl);

    // WebRTC media is realtime: audio that arrives before the element is actually
    // rendering is discarded, not buffered. Reporting 'ready' before playback began
    // let the caller speak into a dead pipeline, losing the opening utterances.
    await Promise.all([
      waitUntilPlaying(videoEl, MEDIA_PLAYBACK_TIMEOUT_MS),
      waitUntilPlaying(audioEl, MEDIA_PLAYBACK_TIMEOUT_MS),
    ]);
    await new Promise(resolve => setTimeout(resolve, AUDIO_PRIME_MS));
    this.options.onStatus('ready');
  }

  /** Speak plain text and resolve when its audio reaches the WebRTC player. */
  async speak(text: string): Promise<void> {
    if (!this.synthesizer) throw new Error('Avatar not connected.');
    this.playbackWaitGeneration += 1;
    this.speechStartOffsetTicks = null;
    this.speechDurationTicks = null;
    this.turnEndOffsetTicks = null;
    this.options.onStatus('speaking');

    // Prepare the TurnEnd waiter BEFORE starting synthesis so we don't miss
    // the event for very short utterances.
    const turnEndPromise = new Promise<void>((resolve) => {
      this.pendingTurnEnd = resolve;
    });

    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await this.synthesizer.speakTextAsync(text);
      if (result?.errorDetails) {
        this.pendingTurnEnd = null;
        this.options.onError(`Speech error: ${result.errorDetails}`);
        this.options.onStatus('error');
        throw new Error(result.errorDetails);
      }
      this.speechDurationTicks = Number.isFinite(result?.audioDuration)
        ? result.audioDuration
        : 0;
      this.scheduleTurnEndResolution();
      // Wait for the avatar to actually finish playing, bounded so a TurnEnd that
      // never arrives cannot stall a multi-step narration indefinitely.
      const stallGuard = new Promise<void>((resolve) => {
        stallTimer = setTimeout(resolve, estimatePlaybackMs(text));
      });
      await Promise.race([turnEndPromise, stallGuard]);
      this.pendingTurnEnd = null;
      this.options.onWord(-1);
      this.options.onStatus('ready');
    } catch (err) {
      this.pendingTurnEnd = null;
      this.options.onStatus('error');
      throw err;
    } finally {
      clearTimeout(stallTimer);
    }
  }

  /** Interrupt current speech mid-sentence. */
  async stopSpeaking(): Promise<void> {
    this.options.onWord(-1);
    this.playbackWaitGeneration += 1;
    // Release any waiter so the loop doesn't hang on a TurnEnd that may not fire.
    const resolver = this.pendingTurnEnd;
    this.pendingTurnEnd = null;
    resolver?.();
    if (!this.synthesizer) return;
    try { await this.synthesizer.stopSpeakingAsync(); } catch { /* ignore */ }
    this.options.onStatus('ready');
  }

  /** Fetch a short-lived Speech STS token from the server-side token endpoint. */
  private async fetchSpeechToken(): Promise<{ token: string; region: string }> {
    const res = await fetch('/api/speech-token');
    if (!res.ok) {
      const data: { error?: string } = await res.json().catch(() => ({}));
      throw new Error(`Speech token error (${res.status}): ${data.error ?? 'unknown'}`);
    }
    return res.json();
  }

  /**
   * Fetch ICE relay credentials server-side (CORS prevents direct browser fetch).
   * Some networks (corp firewalls, VPNs, residential ISPs) block UDP/3478, so we
   * build BOTH the standard UDP entry and a TCP/443 entry and force iceTransportPolicy
   * to 'relay'. This mirrors the `useTcpForWebRTC` workaround in Microsoft's TTS
   * Avatar reference sample. Override at runtime via window.__AVATAR_FORCE_TCP__ = false
   * if you want to test plain UDP.
   */
  private async fetchIceServers(forceTcp: boolean): Promise<RTCIceServer[]> {
    try {
      const iceRes = await fetch('/api/ice-token');
      if (!iceRes.ok) return [];
      const ice = await iceRes.json();
      const baseUrl: string = ice.Urls[0];
      const tcpUrl = baseUrl.replace(':3478', ':443?transport=tcp');
      const urls = forceTcp ? [tcpUrl, baseUrl] : [baseUrl, tcpUrl];
      return [{ urls, username: ice.Username, credential: ice.Password }];
    } catch (err) {
      console.warn('[avatar] /api/ice-token failed:', err);
      return [];
    }
  }

  private waitForPlaybackOffset(offsetTicks: number, generation: number): Promise<void> {
    const targetSeconds = offsetTicks / TICKS_PER_SECOND;
    return new Promise<void>((resolve) => {
      const check = () => {
        if (generation !== this.playbackWaitGeneration || !this.audioElement) {
          resolve();
          return;
        }
        if (this.audioElement.currentTime + MEDIA_CLOCK_TOLERANCE_SECONDS >= targetSeconds) {
          resolve();
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  private scheduleTurnEndResolution(): void {
    if (!this.pendingTurnEnd || this.turnEndOffsetTicks == null || this.speechDurationTicks == null) return;

    const resolver = this.pendingTurnEnd;
    this.pendingTurnEnd = null;
    const generation = this.playbackWaitGeneration;
    const spokenEndOffset = this.speechStartOffsetTicks != null && this.speechDurationTicks > 0
      ? this.speechStartOffsetTicks + this.speechDurationTicks
      : this.turnEndOffsetTicks;
    const targetOffset = Math.min(spokenEndOffset, this.turnEndOffsetTicks);

    void this.waitForPlaybackOffset(targetOffset, generation).then(() => {
      if (generation === this.playbackWaitGeneration) {
        this.options.onStatus('ready');
      }
      resolver();
    });
  }

  /** Close the WebRTC session and release all resources. */
  disconnect(): void {
    this.playbackWaitGeneration += 1;
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.videoStream?.getTracks().forEach(track => track.stop());
    this.audioStream?.getTracks().forEach(track => track.stop());
    this.videoStream = null;
    this.audioStream = null;
    this.audioElement = null;
    if (this.synthesizer) {
      try { this.synthesizer.close(); } catch { /* ignore */ }
      this.synthesizer = null;
    }
    this.options.onStatus('idle');
  }

  get isConnected(): boolean {
    return this.synthesizer !== null;
  }
}
