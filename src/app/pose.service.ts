import { Injectable } from '@angular/core';
import type { GestureRecognizerResult } from '@mediapipe/tasks-vision';
import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
  PoseLandmarker,
} from '@mediapipe/tasks-vision';

@Injectable({ providedIn: 'root' })
export class PoseService {
  readonly isLite = false;
  private bodyLandmarker!: PoseLandmarker;
  private gestureRecognizer!: GestureRecognizer;

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    );

    this.bodyLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/pose_landmarker_lite.task',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

    this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/gesture_recognizer.task',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  detect(
    video: HTMLVideoElement,
    canvas?: HTMLCanvasElement | null,
  ): GestureRecognizerResult | null {
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    if (canvas) {
      const ctx = canvas.getContext('2d')!;
      const drawingUtils = new DrawingUtils(ctx);

      const result = this.bodyLandmarker.detectForVideo(video, performance.now());

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const landmark of result.landmarks) {
        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {
          color: '#00FF00',
          lineWidth: 1,
        });
        drawingUtils.drawLandmarks(landmark, { color: '#FF0000', lineWidth: 1 });
      }
    }

    const gestureResult = this.gestureRecognizer.recognizeForVideo(video, performance.now());

    return gestureResult;
  }
}
