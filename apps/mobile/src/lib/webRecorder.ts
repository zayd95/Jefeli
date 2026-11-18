/**
 * Web video recording for the Studio (P2). expo-camera records on phones only; in a browser we
 * record the camera's own stream with MediaRecorder, with the microphone's audio, and keep one
 * frame as the poster. Same 3-minute cap as everywhere (the database enforces it again).
 */

export interface WebRecordingResult {
  file: Blob;
  poster: Blob | null;
  width: number;
  height: number;
}

export interface WebRecording {
  stop: () => Promise<WebRecordingResult>;
}

function pickMime(): string | undefined {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
}

function grabFrame(video: HTMLVideoElement): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8));
  } catch {
    return Promise.resolve(null);
  }
}

export async function startWebRecording(host: HTMLElement | null, maxMs: number): Promise<WebRecording> {
  const video = host?.querySelector('video') ?? null;
  const camera = video?.srcObject;
  if (!video || !(camera instanceof MediaStream)) throw new Error('no_camera_stream');
  const tracks = [...camera.getVideoTracks()];
  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    tracks.push(...micStream.getAudioTracks());
  } catch {
    /* no microphone: a silent video is still a video */
  }
  const mimeType = pickMime();
  const recorder = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const poster = grabFrame(video);
  const finished = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  const timer = setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), maxMs);
  recorder.start(250);
  return {
    async stop() {
      clearTimeout(timer);
      if (recorder.state !== 'inactive') recorder.stop();
      await finished;
      micStream?.getTracks().forEach((t) => t.stop());
      return {
        file: new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }),
        poster: await poster,
        width: video.videoWidth || 720,
        height: video.videoHeight || 1280,
      };
    },
  };
}
