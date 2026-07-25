import { useCallback, useEffect, useRef, useState } from "react";

type RecordingState = {
  isSupported: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  elapsedSeconds: number;
  error: string | null;
  recordedFile: File | null;
  recordingDurationSeconds: number | null;
  previewUrl: string | null;
};

function getAudioSupportLevel(mimeType: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }

  try {
    const audio = document.createElement("audio");
    return audio.canPlayType(mimeType);
  } catch {
    return "";
  }
}

function chooseSupportedMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/m4a",
  ];

  const supported = candidates.filter((mimeType) => {
    try {
      return mimeType
        ? MediaRecorder.isTypeSupported(mimeType) && getAudioSupportLevel(mimeType) !== ""
        : false;
    } catch {
      return false;
    }
  });

  const probable = supported.find((mimeType) => getAudioSupportLevel(mimeType) === "probably");
  return probable ?? supported[0] ?? "";
}

function formatMediaError(error: unknown) {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Microphone permission denied. Allow access and try again.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No microphone found. Please connect a microphone and try again.";
      case "NotReadableError":
      case "TrackStartError":
        return "Cannot access the microphone. Check your device settings.";
      default:
        return error.message || "Recording failed. Please try again.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Recording failed. Please try again.";
}

export type UseVoiceRecorderOptions = {
  onRecordingStateChange?: (isRecording: boolean) => void;
};

export function useVoiceRecorder({ onRecordingStateChange }: UseVoiceRecorderOptions = {}) {
  const [isSupported] = useState<boolean>(() =>
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const previewUrlRef = useRef<string | null>(null);
  const mimeTypeRef = useRef<string>("");

  useEffect(() => {
    mimeTypeRef.current = chooseSupportedMimeType();
  }, []);

  const setPreview = useCallback((url: string | null) => {
    if (previewUrlRef.current && previewUrlRef.current !== url) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStreamTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const cleanupRecording = useCallback(() => {
    clearTimer();
    stopStreamTracks();
    recorderRef.current = null;
  }, [clearTimer, stopStreamTracks]);

  const reset = useCallback(() => {
    cleanupRecording();
    setIsRecording(false);
    setElapsedSeconds(0);
    setError(null);
    setRecordedFile(null);
    setRecordingDurationSeconds(null);
    setHasRecording(false);
    setPreview(null);
  }, [cleanupRecording, setPreview]);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  useEffect(() => {
    return () => {
      cleanupRecording();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [cleanupRecording]);

  const createFileFromBlob = useCallback((blob: Blob) => {
    const extension = blob.type.includes("ogg") ? "ogg" : "webm";
    return new File([blob], `interview-answer-${Date.now()}.${extension}`, {
      type: blob.type || "audio/webm",
    });
  }, []);

  const start = useCallback(async () => {
    if (!isSupported || isRecording) {
      return;
    }

    setError(null);
    setRecordedFile(null);
    setRecordingDurationSeconds(null);
    setHasRecording(false);
    setPreview(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = mimeTypeRef.current;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        setError(event.error ? formatMediaError(event.error) : "Recording failed. Please try again.");
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob || blob.size === 0) {
          setError("Empty recording. Please try again.");
          setHasRecording(false);
          setPreview(null);
          cleanupRecording();
          return;
        }

        const file = createFileFromBlob(blob);
        const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        setRecordedFile(file);
        setRecordingDurationSeconds(durationSeconds);
        setHasRecording(true);
        setPreview(URL.createObjectURL(blob));
        cleanupRecording();
      };

      recorderRef.current = recorder;
      streamRef.current = stream;
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000)));
      }, 250);

      recorder.start();
    } catch (error) {
      setError(formatMediaError(error));
      stopStreamTracks();
      cleanupRecording();
      setIsRecording(false);
    }
  }, [cleanupRecording, createFileFromBlob, isRecording, isSupported, stopStreamTracks]);

  const stop = useCallback(() => {
    if (!isRecording || !recorderRef.current) {
      return;
    }

    try {
      recorderRef.current.stop();
    } catch {
      // ignore stop failures
    }

    setIsRecording(false);
  }, [isRecording]);

  return {
    isSupported,
    isRecording,
    hasRecording,
    elapsedSeconds,
    error,
    recordedFile,
    recordingDurationSeconds,
    previewUrl,
    start,
    stop,
    reset,
  } as RecordingState & {
    start: () => Promise<void>;
    stop: () => void;
    reset: () => void;
  };
}
