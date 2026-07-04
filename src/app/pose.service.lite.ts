import { Injectable } from '@angular/core';
import type { GestureRecognizerResult } from '@mediapipe/tasks-vision';
import {
  FilesetResolver,
  GestureRecognizer,
} from '@mediapipe/tasks-vision';

@Injectable({ providedIn: 'root' })
export class PoseService {
  readonly isLite = true;
  private gestureRecognizer!: GestureRecognizer;

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    );

    this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/gesture_recognizer.task',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  detect(video: HTMLVideoElement, _canvas?: HTMLCanvasElement | null): GestureRecognizerResult | null {
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const gestureResult = this.gestureRecognizer.recognizeForVideo(video, performance.now());

    return gestureResult;
  }
}
