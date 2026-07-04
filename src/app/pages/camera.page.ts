import type { ElementRef, OnDestroy, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';
import type { GestureRecognizerResult } from '@mediapipe/tasks-vision';
import { PoseService } from '../pose.service';

interface MediaWithPermissions {
  checkPermissions(): Promise<{
    photos?: string;
    publicStorage?: string;
    publicStorage13Plus?: string;
  }>;
  requestPermissions(): Promise<{
    photos?: string;
    publicStorage?: string;
    publicStorage13Plus?: string;
  }>;
}

@Component({
  selector: 'app-camera',
  template: `
    <div class="relative h-dvh w-screen overflow-hidden bg-neutral-950">
      <!-- Camera Feed -->
      <video #video autoplay playsinline muted class="h-full w-full object-cover"></video>
      @if (!poseService.isLite) {
        <canvas #canvas class="absolute top-0 left-0 h-full w-full pointer-events-none"></canvas>
      }

      <!-- Screen Flash Overlay -->
      @if (flashActive()) {
        <div class="absolute inset-0 bg-white z-50 pointer-events-none animate-flash"></div>
      }

      <!-- Subtle Recording Status Indicator (Top-Right) -->
      <div
        class="absolute top-6 right-6 flex items-center gap-2 rounded-full bg-black/60 border border-white/10 px-3 py-1.5 backdrop-blur-md shadow-lg z-20"
      >
        <span class="relative flex h-2 w-2">
          @if (isRecordingActive()) {
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
            ></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          } @else {
            <span class="relative inline-flex rounded-full h-2 w-2 bg-neutral-500"></span>
          }
        </span>
        <span class="text-[10px] font-bold tracking-wider text-neutral-300 uppercase">
          {{ isRecordingActive() ? 'ENTRENANDO' : 'STANDBY' }}
        </span>
        @if (isRecordingActive()) {
          <span
            class="text-[10px] font-mono text-neutral-400 border-l border-white/10 pl-2 tabular-nums"
          >
            {{ recordingDurationStr() }}
          </span>
        }
      </div>

      <!-- Exit Button (Bottom-Left) -->
      <button
        (click)="onExitClick()"
        class="absolute bottom-8 left-8 flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/80 hover:bg-neutral-800 px-5 py-3 font-semibold text-white backdrop-blur-md shadow-2xl transition-all duration-200 active:scale-95 z-30"
      >
        <span class="material-icons text-sm text-rose-400 select-none">arrow_back</span>
        <span class="text-xs tracking-wider uppercase">Salir</span>
      </button>

      <!-- Floating Camera Gesture Progress (Bottom-Right) -->
      <div
        class="absolute bottom-8 right-8 flex flex-col items-end gap-2 z-10"
        role="status"
        [attr.aria-label]="ariaLabel()"
      >
        <!-- Status tooltip -->
        @if (isTracking()) {
          <div
            class="px-3 py-1 rounded-md bg-black/80 backdrop-blur-md text-white text-xs border border-white/10 font-sans shadow-lg animate-fade-in transition-all duration-300"
          >
            @if (progress() < 100) {
              Sostén: {{ (10 - (progress() * 10) / 100).toFixed(1) }}s
            } @else {
              ¡Listo! 📸
            }
          </div>
        }

        <!-- Camera Ring Container -->
        <div
          class="relative flex h-20 w-20 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-300"
          [class.scale-110]="isTracking()"
          [class.shadow-[0_0_20px_rgba(244,63,94,0.5)]]="isTracking() && progress() < 100"
          [class.shadow-[0_0_20px_rgba(34,211,238,0.5)]]="progress() === 100"
        >
          <!-- SVG Circular Progress Ring -->
          <svg class="absolute top-0 left-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
            <!-- Background track -->
            <circle cx="50" cy="50" r="42" class="stroke-white/10 fill-none" stroke-width="5" />
            <!-- Progress circle -->
            <circle
              cx="50"
              cy="50"
              r="42"
              [class.stroke-rose-500]="progress() < 100"
              [class.stroke-cyan-400]="progress() === 100"
              class="fill-none transition-all duration-75 ease-out"
              stroke-width="5"
              stroke-linecap="round"
              [style.strokeDasharray]="263.89"
              [style.strokeDashoffset]="263.89 - (263.89 * progress()) / 100"
            />
          </svg>

          <!-- Camera / Success Icon -->
          <span
            class="material-icons text-3xl select-none"
            [class.text-white]="progress() < 100"
            [class.text-cyan-400]="progress() === 100"
            [class.animate-pulse]="isTracking() && progress() < 100"
            [class.scale-110]="progress() === 100"
          >
            {{ progress() === 100 ? 'check' : 'photo_camera' }}
          </span>
        </div>
      </div>

      <!-- Bottom Sent Photos Gallery Overlay -->
      @if (sentPhotos().length > 0) {
        <div
          class="absolute bottom-28 left-8 right-8 z-20 flex flex-col gap-2 rounded-2xl bg-black/60 border border-white/10 p-4 backdrop-blur-md shadow-2xl transition-all duration-300 animate-slide-up"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold tracking-wider text-cyan-400 uppercase"
              >Fotos Recibidas</span
            >
            <span class="text-[10px] text-neutral-400 font-mono"
              >{{ sentPhotos().length }} enviadas</span
            >
          </div>

          <div class="flex gap-3 overflow-x-auto py-1 scrollbar-none">
            @for (photo of sentPhotos(); track photo.timestamp) {
              <div
                class="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-neutral-900 shadow-md transition-all duration-200 active:scale-95"
              >
                <img [src]="photo.url" class="h-full w-full object-cover" alt="Captura enviada" />
                <div class="absolute inset-0 flex items-center justify-center bg-black/45">
                  <span class="material-icons text-white text-xs select-none">done</span>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    @keyframes flash {
      0% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
    .animate-flash {
      animation: flash 0.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out forwards;
    }
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-slide-up {
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraPage implements OnInit, OnDestroy {
  videoStream: MediaStream | null = null;
  videoElement = viewChild<ElementRef<HTMLVideoElement>>('video');
  canvasElement = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  poseService = inject(PoseService);
  private router = inject(Router);

  private destroyed = false;
  private isPageActive = false;
  private isRecovering = false;

  // Gesture Recognition State (Signals)
  readonly progress = signal<number>(0);
  readonly isTracking = signal<boolean>(false);
  readonly flashActive = signal<boolean>(false);
  readonly hasTriggered = signal<boolean>(false);
  readonly isSuccessState = signal<boolean>(false);

  // Recording State (Signals)
  readonly isRecordingActive = signal<boolean>(false);
  readonly recordingDurationStr = signal<string>('00:00:00');
  readonly uploadedChunksCount = signal<number>(0);
  readonly recordingCodec = signal<string>('');

  // Sent Photos List
  readonly sentPhotos = signal<{ url: string; timestamp: number }[]>([]);

  private mediaRecorder: MediaRecorder | null = null;
  private chunkQueue: Blob[] = [];
  private isUploading = false;
  private currentRecordingId: string | null = null;
  private chunkIndex = 0;
  private mimeType = '';
  private shouldFinalize = false;
  private recordingInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private elapsedSeconds = 0;
  private readonly BACKEND_URL = 'https://dress-up.teodev.site';

  // Computed Accessible Label
  readonly ariaLabel = computed(() => {
    if (this.hasTriggered()) {
      return 'Acción del gesto I Love You completada';
    }
    if (this.isTracking()) {
      return `Registrando gesto I Love You. Progreso: ${String(Math.round(this.progress()))}%`;
    }
    return 'Esperando gesto I Love You';
  });

  // Timer configuration & tracking properties
  private gestureStartTimestamp: number | null = null;
  private lastDetectedTimestamp: number | null = null;
  private readonly GRACE_PERIOD_MS = 800; // 800ms of non-detection allowed before reset
  private readonly TRIGGER_DURATION_MS = 10000; // 10 seconds

  ngOnInit() {
    this.isPageActive = true;
    if (typeof window !== 'undefined') {
      void (async () => {
        await this.poseService.init();
        await this.initializeMedia();
        this.startHealthCheck();
        this.startLoop();
      })();

      // Event listener for visibility change (resuming/suspending in browser/mobile webview)
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.isPageActive = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.stopHealthCheck();
    this.cleanupLocalMedia();
    this.stopRecording();
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && this.isPageActive) {
      console.info('[CameraPage] Visibility changed to visible. Running health check...');
      void this.ensureRecordingIsActive();
    }
  };

  private async initializeMedia() {
    try {
      this.cleanupLocalMedia();

      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const localVideoEl = this.videoElement()?.nativeElement;
      if (localVideoEl) {
        localVideoEl.srcObject = this.videoStream;
        localVideoEl.muted = true;
        void localVideoEl.play();
      }

      // Start recording automatically
      void this.startRecording(this.videoStream);
    } catch (err) {
      console.warn(
        '[CameraPage] initializeMedia → error requesting audio/video, trying video only:',
        err,
      );
      try {
        this.videoStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        const localVideoEl = this.videoElement()?.nativeElement;
        if (localVideoEl) {
          localVideoEl.srcObject = this.videoStream;
          localVideoEl.muted = true;
          void localVideoEl.play();
        }

        // Start recording automatically
        void this.startRecording(this.videoStream);
      } catch (fallbackErr) {
        console.error('[CameraPage] initializeMedia → error obtaining video stream:', fallbackErr);
      }
    }
  }

  private async startRecording(stream: MediaStream) {
    if (typeof window === 'undefined' || !this.isPageActive) return;

    const MIME_TYPES = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=h264',
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=h264',
      'video/webm',
      'video/mp4',
    ];

    this.mimeType = '';
    for (const type of MIME_TYPES) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          this.mimeType = type;
          break;
        }
      } catch {
        // Continue
      }
    }

    if (!this.mimeType) {
      console.error('No supported MIME types found for MediaRecorder');
      return;
    }

    this.recordingCodec.set(this.mimeType.split(';')[0] || this.mimeType);

    try {
      const response = await fetch(`${this.BACKEND_URL}/api/recording/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mimeType: this.mimeType }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start recording on backend: ${response.statusText}`);
      }

      const data = (await response.json()) as { recordingId: string };
      this.currentRecordingId = data.recordingId;
      this.chunkQueue = [];
      this.chunkIndex = 0;
      this.shouldFinalize = false;
      this.uploadedChunksCount.set(0);
      console.info('Backend recording started, ID:', this.currentRecordingId);

      const options: MediaRecorderOptions = {
        mimeType: this.mimeType,
      };

      // Set high video bitrate to preserve quality for AI training
      if (this.mimeType.includes('vp9') || this.mimeType.includes('h264')) {
        options.videoBitsPerSecond = 3000000; // 3 Mbps
      }

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunkQueue.push(event.data);
          void this.processQueue();
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder onerror fired:', event);
        void this.recoverRecording();
      };

      // Start recording with 3-second slices
      this.mediaRecorder.start(3000);
      this.isRecordingActive.set(true);
      this.startDurationTimer();
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  }

  private stopRecording() {
    this.stopDurationTimer();
    this.isRecordingActive.set(false);

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.error('Error stopping MediaRecorder:', err);
      }
    }

    this.shouldFinalize = true;
    void this.processQueue();
  }

  private async processQueue() {
    if (this.isUploading) return;

    if (this.chunkQueue.length === 0) {
      if (this.shouldFinalize && this.currentRecordingId) {
        await this.sendStopRecording();
      }
      return;
    }

    this.isUploading = true;
    const chunk = this.chunkQueue[0];
    const index = this.chunkIndex;

    try {
      const success = await this.uploadChunk(chunk, index);
      if (success) {
        this.chunkQueue.shift();
        this.chunkIndex++;
        this.uploadedChunksCount.set(this.chunkIndex);
      } else {
        console.warn(`Chunk ${String(index)} upload failed, will retry in next loop...`);
      }
    } catch (err) {
      console.error(`Error processing chunk at index ${String(index)}:`, err);
    } finally {
      this.isUploading = false;
      // Recurse to process the remaining queue
      setTimeout(() => {
        void this.processQueue();
      }, 500);
    }
  }

  private async uploadChunk(chunk: Blob, index: number): Promise<boolean> {
    if (!this.currentRecordingId) return false;

    try {
      const response = await fetch(`${this.BACKEND_URL}/api/recording/chunk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-recording-id': this.currentRecordingId,
          'x-chunk-index': String(index),
        },
        body: chunk,
      });

      return response.ok;
    } catch (err) {
      console.error(`Network error uploading chunk ${String(index)}:`, err);
      return false;
    }
  }

  private async sendStopRecording() {
    const recordingId = this.currentRecordingId;
    this.currentRecordingId = null;
    this.shouldFinalize = false;

    if (!recordingId) return;

    try {
      const response = await fetch(`${this.BACKEND_URL}/api/recording/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recordingId }),
      });

      if (!response.ok) {
        console.error('Failed to finalize recording on backend:', response.statusText);
        return;
      }

      const data = (await response.json()) as { status: string };
      console.info('Backend recording finalized successfully:', data);
    } catch (err) {
      console.error('Error finalising backend recording:', err);
    }
  }

  private startDurationTimer() {
    this.stopDurationTimer();
    this.elapsedSeconds = 0;
    this.recordingDurationStr.set('00:00:00');
    this.recordingInterval = setInterval(() => {
      this.elapsedSeconds++;
      const hours = Math.floor(this.elapsedSeconds / 3600);
      const minutes = Math.floor((this.elapsedSeconds % 3600) / 60);
      const seconds = this.elapsedSeconds % 60;
      const pad = (num: number) => String(num).padStart(2, '0');
      this.recordingDurationStr.set(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    }, 1000);
  }

  private stopDurationTimer() {
    if (this.recordingInterval !== null) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
  }

  private cleanupLocalMedia() {
    if (!this.videoStream) return;

    this.videoStream.getTracks().forEach((track) => {
      track.stop();
    });

    this.videoStream = null;
  }

  private startLoop() {
    const loop = () => {
      if (this.destroyed || !this.isPageActive) return;

      const video = this.videoElement()?.nativeElement;
      const canvas = this.canvasElement()?.nativeElement;

      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const gestureResult = this.poseService.detect(video, canvas);
        this.processGestureResult(gestureResult);
      } else {
        this.resetTracking();
      }

      requestAnimationFrame(loop);
    };

    loop();
  }

  private processGestureResult(gestureResult: GestureRecognizerResult | null) {
    if (this.isSuccessState()) {
      return;
    }

    const now = performance.now();
    let isILoveYouDetected = false;

    if (gestureResult) {
      for (const handGestures of gestureResult.gestures) {
        for (const category of handGestures) {
          if (category.categoryName === 'ILoveYou' && category.score > 0.5) {
            isILoveYouDetected = true;
            break;
          }
        }
        if (isILoveYouDetected) break;
      }
    }

    if (isILoveYouDetected) {
      this.lastDetectedTimestamp = now;
      if (this.gestureStartTimestamp === null) {
        this.gestureStartTimestamp = now;
        this.isTracking.set(true);
      }
    }

    if (this.gestureStartTimestamp !== null) {
      const timeSinceLastDetection = now - (this.lastDetectedTimestamp ?? now);

      if (timeSinceLastDetection > this.GRACE_PERIOD_MS) {
        this.resetTracking();
      } else {
        const elapsed = now - this.gestureStartTimestamp;
        const pct = Math.min((elapsed / this.TRIGGER_DURATION_MS) * 100, 100);
        this.progress.set(pct);

        if (elapsed >= this.TRIGGER_DURATION_MS) {
          if (!this.hasTriggered()) {
            void this.triggerAction();
          }
        }
      }
    } else {
      this.progress.set(0);
      this.isTracking.set(false);
    }
  }

  private resetTracking() {
    this.gestureStartTimestamp = null;
    this.lastDetectedTimestamp = null;
    this.hasTriggered.set(false);
    this.progress.set(0);
    this.isTracking.set(false);
    this.isSuccessState.set(false);
  }

  private async triggerAction() {
    this.hasTriggered.set(true);
    this.isSuccessState.set(true);

    // Verify recording is active, if not restart/recover it immediately!
    await this.ensureRecordingIsActive();

    // Capture the current camera frame as base64 image
    const base64Photo = this.captureFrameAsBase64();
    if (base64Photo) {
      // Append captured photo to list
      this.sentPhotos.update((photos) => [{ url: base64Photo, timestamp: Date.now() }, ...photos]);

      // Upload photo to backend in the background
      void this.uploadPhoto(base64Photo);

      try {
        if (Capacitor.isNativePlatform()) {
          const mediaWithPerms = Media as unknown as MediaWithPermissions;
          let status = await mediaWithPerms.checkPermissions();
          if (!this.isPermissionGranted(status)) {
            status = await mediaWithPerms.requestPermissions();
            if (!this.isPermissionGranted(status)) {
              throw new Error('Permiso de fotos denegado');
            }
          }
          const albumsResponse = await Media.getAlbums();
          const targetNames = [
            'camera',
            'dcim',
            'pictures',
            'images',
            'imágenes',
            'imagenes',
            'dress-up',
          ];
          let album = albumsResponse.albums.find((a) => targetNames.includes(a.name.toLowerCase()));

          if (!album) {
            await Media.createAlbum({ name: 'Dress-Up' });
            const refetched = await Media.getAlbums();
            album = refetched.albums.find((a) => a.name.toLowerCase() === 'dress-up');
          }

          if (!album) {
            throw new Error('No se pudo encontrar ni crear un álbum destino.');
          }

          await Media.savePhoto({
            path: base64Photo,
            albumIdentifier: album.identifier,
          });
        }
      } catch (err) {
        console.error('Error al guardar la foto en la galería nativa:', err);
      }
    } else {
      console.error('Error: No se pudo capturar el frame del video para la foto.');
    }

    // Trigger screen flash shutter effect
    this.flashActive.set(true);
    setTimeout(() => {
      this.flashActive.set(false);
    }, 500);

    // Keep the "success/complete" visual state lock for 2 seconds, then reset
    setTimeout(() => {
      this.resetTracking();
    }, 2000);
  }

  private captureFrameAsBase64(): string | null {
    const video = this.videoElement()?.nativeElement;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const tempCanvas = document.createElement('canvas');

    // Scale down resolution if it exceeds 1280px width to preserve storage
    const MAX_WIDTH = 1280;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > MAX_WIDTH) {
      const scale = MAX_WIDTH / width;
      width = MAX_WIDTH;
      height = Math.round(height * scale);
    }

    tempCanvas.width = width;
    tempCanvas.height = height;

    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    // Lower quality to 0.7 to save lots of space while maintaining great visual features for AI models
    return tempCanvas.toDataURL('image/jpeg', 0.7);
  }

  private async uploadPhoto(base64Data: string) {
    if (!base64Data) return;

    try {
      const response = await fetch(base64Data);
      const blob = await response.blob();

      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
      };

      if (this.currentRecordingId) {
        headers['x-recording-id'] = this.currentRecordingId;
      }

      const uploadResponse = await fetch(`${this.BACKEND_URL}/api/recording/photo`, {
        method: 'POST',
        headers,
        body: blob,
      });

      if (!uploadResponse.ok) {
        console.error('Failed to upload photo to backend:', uploadResponse.statusText);
        return;
      }

      const resData = (await uploadResponse.json()) as { filename: string; size: number };
      console.info('Photo uploaded to backend successfully:', resData);
    } catch (err) {
      console.error('Error uploading photo:', err);
    }
  }

  private isPermissionGranted(status: {
    photos?: string;
    publicStorage?: string;
    publicStorage13Plus?: string;
  }): boolean {
    if (status.photos !== undefined) {
      return status.photos === 'granted';
    }
    return status.publicStorage === 'granted' || status.publicStorage13Plus === 'granted';
  }

  // Robustness / Auto-recovery system
  private startHealthCheck() {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(() => {
      void this.ensureRecordingIsActive();
    }, 4000);
  }

  private stopHealthCheck() {
    if (this.healthCheckInterval !== null) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async ensureRecordingIsActive() {
    if (this.destroyed || !this.isPageActive || this.isRecovering) return;

    const isStreamOk = !!(
      this.videoStream && this.videoStream.getTracks().some((t) => t.readyState === 'live')
    );
    const isRecorderOk = this.mediaRecorder && this.mediaRecorder.state === 'recording';
    const isSessionOk = this.currentRecordingId !== null;

    if (!isStreamOk || !isRecorderOk || !isSessionOk) {
      console.warn(
        `[CameraPage] Health check failed: Stream=${String(isStreamOk)}, Recorder=${
          this.mediaRecorder?.state || 'null'
        }, Session=${String(isSessionOk)}. Initiating recovery...`,
      );
      await this.recoverRecording();
    }
  }

  private async recoverRecording() {
    if (this.isRecovering) return;
    this.isRecovering = true;

    try {
      console.info('[CameraPage] Recovering stream and media recorder...');

      // Stop old recorder/stream cleanly
      this.stopDurationTimer();
      this.isRecordingActive.set(false);

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch {
          // Ignore
        }
      }
      this.mediaRecorder = null;
      this.cleanupLocalMedia();

      // Pause for a brief moment to allow hardware release
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (this.destroyed || !this.isPageActive) return;

      // Re-initialize media
      await this.initializeMedia();
      console.info('[CameraPage] Recovery complete.');
    } catch (err) {
      console.error('[CameraPage] Recovery failed:', err);
    } finally {
      this.isRecovering = false;
    }
  }

  async onExitClick() {
    this.isPageActive = false;
    this.stopHealthCheck();
    this.stopRecording();
    this.cleanupLocalMedia();
    await this.router.navigate(['/welcome']);
  }
}
