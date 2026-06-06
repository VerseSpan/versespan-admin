/**
 * WebSocket client for real-time translation streaming
 * Connects to FastAPI backend and handles audio streaming
 */

import { type TranslationMessage } from './store';

export interface TranslationClientConfig {
  sessionId: string;
  apiUrl?: string;
  onTranslation?: (message: TranslationMessage) => void;
  onStatus?: (message: TranslationMessage) => void;
  onError?: (error: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  onStreamingResumed?: () => void;
  onSongStarted?: (message: TranslationMessage) => void;
  onSongEnded?: (message: TranslationMessage) => void;
  onPresenting?: (message: TranslationMessage) => void;
  onPresentingCleared?: () => void;
}

export class TranslationClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private audioStream: MediaStream | null = null;
  private config: TranslationClientConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private pingInterval: NodeJS.Timeout | null = null;
  private intentionalDisconnect = false;
  private wasStreamingBeforeDisconnect = false;

  constructor(config: TranslationClientConfig) {
    this.config = config;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    const apiUrl = this.config.apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const fullUrl = `${wsUrl}/api/ws/sessions/${this.config.sessionId}${token ? `?token=${token}` : ''}`;

    console.log('[TranslationClient] Connecting to:', fullUrl);
    console.log('[TranslationClient] Session ID:', this.config.sessionId);
    console.log('[TranslationClient] API URL:', apiUrl);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(fullUrl);

        this.ws.onopen = () => {
          console.log('[TranslationClient] ✓ Connected to translation service');
          console.log('[TranslationClient] WebSocket readyState:', this.ws?.readyState, '(OPEN)');
          const isReconnect = this.reconnectAttempts > 0;
          this.reconnectAttempts = 0;
          this.config.onConnectionChange?.(true);

          // If audio was streaming before the disconnect, notify so the UI can restore it
          if (isReconnect && this.wasStreamingBeforeDisconnect) {
            console.log('[TranslationClient] Reconnected — audio was streaming before disconnect, resuming');
            this.config.onStreamingResumed?.();
          }

          // Start ping interval to keep connection alive
          this.startPingInterval();

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: TranslationMessage = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[TranslationClient] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[TranslationClient] ✗ WebSocket error:', error);
          console.error('[TranslationClient] WebSocket readyState:', this.ws?.readyState);
          console.error('[TranslationClient] WebSocket URL:', fullUrl);
          console.error('[TranslationClient] Session ID:', this.config.sessionId);
          this.config.onError?.(`WebSocket connection error. URL: ${fullUrl}`);
        };

        this.ws.onclose = (event) => {
          const closeReasons: Record<number, string> = {
            1000: 'Normal closure',
            1006: 'Abnormal closure (connection lost)',
            1008: 'Policy violation (e.g., session not found)',
            1011: 'Server error',
            1012: 'Service restart',
          };

          console.log('[TranslationClient] WebSocket closed');
          console.log('[TranslationClient] - Code:', event.code);
          console.log('[TranslationClient] - Reason:', event.reason || 'No reason provided');
          console.log('[TranslationClient] - Clean close:', event.wasClean);
          console.log('[TranslationClient] - Meaning:', closeReasons[event.code] || 'Unknown');

          // Track whether audio was streaming so we can resume after reconnect
          this.wasStreamingBeforeDisconnect = this.isStreaming();

          this.config.onConnectionChange?.(false);
          this.stopPingInterval();

          // Attempt reconnection only for recoverable errors (not intentional disconnects)
          if (!this.intentionalDisconnect && this.reconnectAttempts < this.maxReconnectAttempts && event.code !== 1008) {
            this.reconnectAttempts++;
            console.log(`[TranslationClient] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), 1000);
          } else {
            if (event.code === 1008) {
              this.config.onError?.('Session not found. Please create a new session.');
            } else {
              this.config.onError?.('Connection lost. Maximum reconnection attempts reached.');
            }
          }
        };
      } catch (error) {
        console.error('[TranslationClient] Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: TranslationMessage): void {
    console.log('[TranslationClient] Received:', message.type, message);

    switch (message.type) {
      case 'translation':
        this.config.onTranslation?.(message);
        break;
      case 'status':
        this.config.onStatus?.(message);
        break;
      case 'error':
        this.config.onError?.(message.error || 'Unknown error');
        break;
      case 'pong':
        // Keep-alive response
        break;
      case 'song_started':
        console.log('[TranslationClient] Song started:', message.song_titles, message.song_id);
        this.config.onSongStarted?.(message);
        break;
      case 'song_ended':
        console.log('[TranslationClient] Song ended:', message.song_id, message.reason);
        this.config.onSongEnded?.(message);
        break;
      case 'viewer_count':
      case 'connected_users':
        this.config.onStatus?.(message);
        break;
      case 'presenting':
        this.config.onPresenting?.(message);
        break;
      case 'presenting_cleared':
        this.config.onPresentingCleared?.();
        break;
      case 'server_restart':
        console.log('[TranslationClient] Server is restarting, will reconnect automatically');
        this.reconnectAttempts = 0;
        break;
      default:
        console.warn('[TranslationClient] Unknown message type:', message);
    }
  }

  /**
   * Start capturing audio from specified device using AudioWorklet
   */
  async startAudioCapture(deviceId: string): Promise<void> {
    console.log('[TranslationClient] Starting audio capture from device:', deviceId);

    if (!deviceId) {
      console.warn('[TranslationClient] ⚠️ No device ID provided! Will use default audio input.');
    }

    try {
      // Request audio stream from specified device
      const constraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      console.log('[TranslationClient] Audio constraints:', constraints);

      this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Log the actual device being used
      const audioTrack = this.audioStream.getAudioTracks()[0];
      console.log('[TranslationClient] ✓ Audio track obtained:', {
        label: audioTrack.label,
        deviceId: audioTrack.getSettings().deviceId,
        sampleRate: audioTrack.getSettings().sampleRate,
        channelCount: audioTrack.getSettings().channelCount,
      });

      // Create AudioContext
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      console.log('[TranslationClient] ✓ AudioContext created (48kHz)');

      // Load AudioWorklet processor
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');
      console.log('[TranslationClient] ✓ AudioWorklet processor loaded');

      // Create source from microphone
      const source = this.audioContext.createMediaStreamSource(this.audioStream);

      // Create AudioWorklet node
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');

      // Handle audio data from worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          this.sendPCM16Chunk(event.data.data);
        }
      };

      // Connect: microphone -> worklet -> destination (for monitoring, optional)
      source.connect(this.audioWorkletNode);
      // Note: Not connecting to destination to avoid feedback

      console.log('[TranslationClient] ✓ Audio capture started (PCM16 format, 48kHz, mono)');
    } catch (error) {
      console.error('[TranslationClient] Failed to start audio capture:', error);
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
  stopAudioCapture(): void {
    console.log('[TranslationClient] Stopping audio capture');

    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
  }

  /**
   * Send PCM16 audio chunk to server
   */
  private sendPCM16Chunk(arrayBuffer: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[TranslationClient] WebSocket not ready, skipping audio chunk');
      return;
    }

    try {
      // Convert ArrayBuffer to base64
      const bytes = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...bytes));

      console.log(`[TranslationClient] 📤 Sending PCM16 chunk: ${arrayBuffer.byteLength} bytes`);

      // Send to server as PCM16
      this.send({
        type: 'audio',
        format: 'pcm16',
        sample_rate: 48000,
        data: base64,
      });
    } catch (error) {
      console.error('[TranslationClient] ✗ Failed to send audio chunk:', error);
    }
  }

  /**
   * Send message to server
   */
  private send(message: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[TranslationClient] Cannot send message, WebSocket not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 20000); // Ping every 20 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    console.log('[TranslationClient] Disconnecting');

    this.intentionalDisconnect = true;
    this.stopAudioCapture();
    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.config.onConnectionChange?.(false);
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Check if audio is currently streaming
   */
  isStreaming(): boolean {
    return this.audioWorkletNode !== null && this.audioContext !== null && this.audioContext.state === 'running';
  }
}