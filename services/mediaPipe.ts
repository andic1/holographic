import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export class VisionService {
  private static handLandmarker: HandLandmarker | null = null;
  private static video: HTMLVideoElement | null = null;
  private static lastVideoTime = -1;

  static async initialize() {
    if (this.handLandmarker) return;

    // Prefer local assets to avoid CDN timeouts in production.
    // Put files under: public/mediapipe/wasm/*
    const base = import.meta.env.BASE_URL || "/";
    const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        // Put model under: public/mediapipe/models/hand_landmarker.task
        modelAssetPath: `${base}mediapipe/models/hand_landmarker.task`,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
  }

  static detect(video: HTMLVideoElement) {
    if (!this.handLandmarker) return null;

    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      return this.handLandmarker.detectForVideo(video, performance.now());
    }
    return null;
  }
}