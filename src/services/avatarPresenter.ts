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
}

export class AvatarPresenter {
  private synthesizer: any = null;
  private peerConnection: RTCPeerConnection | null = null;
  private options: Required<AvatarPresenterOptions>;
  private words: string[] = [];

  constructor(options: AvatarPresenterOptions = {}) {
    this.options = {
      character: options.character ?? 'lisa',
      style: options.style ?? 'casual-sitting',
      voice: options.voice ?? 'en-US-AvaMultilingualNeural',
      onStatus: options.onStatus ?? (() => {}),
      onError: options.onError ?? (() => {}),
      onWord: options.onWord ?? (() => {}),
    };
  }

  /**
   * Establish a WebRTC avatar session. Attaches the video/audio streams to the
   * provided media elements once the connection is ready.
   */
  async connect(videoEl: HTMLVideoElement, audioEl: HTMLAudioElement): Promise<void> {
    this.options.onStatus('connecting');

    // Dynamic import keeps the ~10 MB SDK out of the initial bundle
    const SpeechSDK = await import('microsoft-cognitiveservices-speech-sdk');

    // Fetch a short-lived Speech token (aad#resourceId#aadToken format)
    const { token, region } = await this.fetchSpeechToken();

    // Must use fromEndpoint + set authorizationToken — fromAuthorizationToken does not
    // accept the aad# format required for Entra ID auth (WebSocket 1006 error otherwise)
    const wssUrl = new URL(`wss://${region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?enableTalkingAvatar=true`);
    const speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(wssUrl);
    speechConfig.authorizationToken = token;
    speechConfig.speechSynthesisVoiceName = this.options.voice;

    // Fetch ICE relay credentials server-side (CORS prevents direct browser fetch)
    let iceServers: RTCIceServer[] = [];
    try {
      const iceRes = await fetch('/api/ice-token');
      if (iceRes.ok) {
        const ice = await iceRes.json();
        iceServers = [{ urls: [ice.Urls[0]], username: ice.Username, credential: ice.Password }];
      }
    } catch { /* non-fatal — connection may still work on good networks */ }

    const avatarConfig = new SpeechSDK.AvatarConfig(
      this.options.character,
      this.options.style,
      new SpeechSDK.AvatarVideoFormat(),
    );

    // Pass ICE relay servers to the avatar config (required by the SDK)
    if (iceServers.length > 0) {
      (avatarConfig as any).remoteIceServers = iceServers;
    }

    // Create the peer connection with ICE relay servers
    this.peerConnection = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'all' });

    // Add sendrecv transceivers so Azure can deliver the video/audio tracks
    this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    // Wire incoming tracks to the media elements and explicitly play.
    // autoPlay attribute alone can silently fail on media streams in Chrome.
    this.peerConnection.ontrack = (event: RTCTrackEvent) => {
      if (event.track.kind === 'video' && event.streams[0]) {
        videoEl.srcObject = event.streams[0];
        videoEl.muted = true; // required for autoplay policy
        videoEl.play().catch(() => {
          // If muted play fails, try unmuted (user already interacted)
          videoEl.muted = false;
          videoEl.play().catch(() => {});
        });
      } else if (event.track.kind === 'audio' && event.streams[0]) {
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch(() => {});
      }
    };

    this.synthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);

    // Track speaking state
    this.synthesizer.avatarEventReceived = (_s: any, e: any) => {
      if (e.description === 'SwitchToSpeaking') {
        this.options.onStatus('speaking');
      } else if (e.description === 'TurnEnd') {
        this.options.onStatus('ready');
      }
    };

    const result = await this.synthesizer.startAvatarAsync(this.peerConnection);

    if (result.reason !== SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
      const detail = result.errorDetails ?? 'Unknown error';
      this.options.onStatus('error');
      this.options.onError(`Avatar failed to start: ${detail}`);
      this.disconnect();
      throw new Error(detail);
    }

    this.options.onStatus('ready');
  }

  /** Speak text. The avatar will animate and lip-sync to the synthesized speech. */
  speak(text: string): Promise<void> {
    if (!this.synthesizer) {
      return Promise.reject(new Error('Avatar not connected.'));
    }
    // Tokenize words so WordBoundary char offsets can map to a word index
    this.words = text.split(/\s+/).filter(Boolean);
    let charOffset = 0;
    const wordStartOffsets: number[] = [];
    for (const word of this.words) {
      const idx = text.indexOf(word, charOffset);
      wordStartOffsets.push(idx);
      charOffset = idx + word.length;
    }

    this.synthesizer.wordBoundary = (_s: any, e: any) => {
      // e.textOffset is the char offset of the word in the spoken string
      let best = 0;
      for (let i = 0; i < wordStartOffsets.length; i++) {
        if (wordStartOffsets[i] <= e.textOffset) best = i;
        else break;
      }
      this.options.onWord(best);
    };

    this.options.onStatus('speaking');
    return new Promise((resolve, reject) => {
      this.synthesizer.speakTextAsync(
        text,
        () => { this.options.onWord(-1); resolve(); },
        (err: string) => {
          this.options.onError(`Speech error: ${err}`);
          this.options.onStatus('error');
          reject(new Error(err));
        },
      );
    });
  }

  /** Interrupt current speech mid-sentence. */
  stopSpeaking(): void {
    this.options.onWord(-1);
    if (this.synthesizer) {
      this.synthesizer.stopSpeakingAsync(
        () => this.options.onStatus('ready'),
        () => this.options.onStatus('ready'),
      );
    }
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

  /** Close the WebRTC session and release all resources. */
  disconnect(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
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
