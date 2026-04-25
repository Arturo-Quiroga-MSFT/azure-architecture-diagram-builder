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
  private videoStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
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
    this.videoStream = new MediaStream();
    this.audioStream = new MediaStream();

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

    // Fetch ICE relay credentials server-side (CORS prevents direct browser fetch).
    // Some networks (corp firewalls, VPNs, residential ISPs) block UDP/3478, so we
    // build BOTH the standard UDP entry and a TCP/443 entry and force iceTransportPolicy
    // to 'relay'. This mirrors the `useTcpForWebRTC` workaround in Microsoft's TTS
    // Avatar reference sample. Override at runtime via window.__AVATAR_FORCE_TCP__ = false
    // if you want to test plain UDP.
    let iceServers: RTCIceServer[] = [];
    const forceTcp = (typeof window !== 'undefined' && (window as any).__AVATAR_FORCE_TCP__ !== false);
    try {
      const iceRes = await fetch('/api/ice-token');
      if (iceRes.ok) {
        const ice = await iceRes.json();
        const baseUrl: string = ice.Urls[0];
        const tcpUrl = baseUrl.replace(':3478', ':443?transport=tcp');
        const urls = forceTcp ? [tcpUrl, baseUrl] : [baseUrl, tcpUrl];
        iceServers = [{ urls, username: ice.Username, credential: ice.Password }];
        console.log('[avatar] ICE servers:', urls, '(forceTcp=' + forceTcp + ')');
      }
    } catch (err) {
      console.warn('[avatar] /api/ice-token failed:', err);
    }

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
      console.log('[avatar] ontrack:', event.track.kind, {
        id: event.track.id,
        readyState: event.track.readyState,
        muted: event.track.muted,
        streams: event.streams.length,
      });

      const stream = event.streams[0] ?? (() => {
        const s = new MediaStream();
        s.addTrack(event.track);
        return s;
      })();

      if (event.track.kind === 'video') {
        this.videoStream = stream;
        videoEl.srcObject = stream;
        const tryPlay = () => {
          console.log('[avatar] video metadata:', videoEl.videoWidth, 'x', videoEl.videoHeight);
          playMedia(videoEl);
        };
        videoEl.onloadedmetadata = tryPlay;
        videoEl.onloadeddata = tryPlay;
        event.track.onunmute = () => { console.log('[avatar] video unmuted'); playMedia(videoEl); };
        event.track.onended = () => console.log('[avatar] video track ended');
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

    // Track speaking state
    this.synthesizer.avatarEventReceived = (_s: any, e: any) => {
      if (e.description === 'SwitchToSpeaking') {
        this.options.onStatus('speaking');
      } else if (e.description === 'TurnEnd') {
        this.options.onStatus('ready');
      }
    };

    // Log ICE connection state changes for diagnostics
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[avatar] ICE state:', state);
      if (state === 'failed') {
        this.options.onError('WebRTC ICE connection failed. Check network/firewall.');
        this.options.onStatus('error');
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('[avatar] peer state:', this.peerConnection?.connectionState);
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
    this.videoStream?.getTracks().forEach(track => track.stop());
    this.audioStream?.getTracks().forEach(track => track.stop());
    this.videoStream = null;
    this.audioStream = null;
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
