// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * AvatarPresenter — wraps the Azure TTS Avatar JS SDK for the "Present Critique"
 * feature in CompareModelsModal. The avatar session runs entirely client-side via
 * WebRTC.
 *
 * Auth: keyless — a short-lived Speech STS token is fetched from /api/speech-token,
 * which uses DefaultAzureCredential server-side (az login in dev, managed identity
 * in ACA). No API key is ever embedded in the browser bundle.
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
}

export class AvatarPresenter {
  private synthesizer: any = null;
  private peerConnection: RTCPeerConnection | null = null;
  private options: Required<AvatarPresenterOptions>;

  constructor(options: AvatarPresenterOptions = {}) {
    this.options = {
      character: options.character ?? 'lisa',
      style: options.style ?? 'casual-sitting',
      voice: options.voice ?? 'en-US-AvaMultilingualNeural',
      onStatus: options.onStatus ?? (() => {}),
      onError: options.onError ?? (() => {}),
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

    // Fetch a short-lived Speech token from the server-side token endpoint.
    // The server uses DefaultAzureCredential so no key is ever in the browser.
    const { token, region } = await this.fetchSpeechToken();

    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechSynthesisVoiceName = this.options.voice;

    const avatarConfig = new SpeechSDK.AvatarConfig(
      this.options.character,
      this.options.style,
      new SpeechSDK.AvatarVideoFormat(),
    );

    // Create the peer connection; the SDK populates ICE servers during startAvatarAsync
    this.peerConnection = new RTCPeerConnection();

    // Add sendrecv transceivers so Azure can deliver the video/audio tracks
    this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    // Wire incoming tracks to the media elements
    this.peerConnection.ontrack = (event: RTCTrackEvent) => {
      if (event.track.kind === 'video' && event.streams[0]) {
        videoEl.srcObject = event.streams[0];
      } else if (event.track.kind === 'audio' && event.streams[0]) {
        audioEl.srcObject = event.streams[0];
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
    this.options.onStatus('speaking');
    return new Promise((resolve, reject) => {
      this.synthesizer.speakTextAsync(
        text,
        () => resolve(),
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
