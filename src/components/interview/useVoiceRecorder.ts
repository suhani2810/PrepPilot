import { useCallback, useEffect, useRef, useState } from "react";

type RecordingState = {
  isSupported: boolean;
  supportChecked: boolean;
  supportError: string | null;
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
        return "Microphone access was denied. Allow microphone access in your browser and try again.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No microphone was found. Connect a microphone and try again.";
      case "NotReadableError":
      case "TrackStartError":
        return "The microphone is unavailable right now. Check your device settings and try again.";
      case "AbortError":
        return "Recording was interrupted. Please try again.";
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
  const [isSupported, setIsSupported] = useState(false);
  const [supportChecked, setSupportChecked] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
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
  const startInProgressRef = useRef(false);
  const startRequestRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const previewUrlRef = useRef<string | null>(null);
  const mimeTypeRef = useRef<string>("");
  const isMountedRef = useRef(true);

  useEffect(() => {
    const secure = window.isSecureContext;
    const hasMediaDevices =
      !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
    const hasRecorder = typeof MediaRecorder !== "undefined";
    const supported = secure && hasMediaDevices && hasRecorder;
    setIsSupported(supported);
    setSupportError(
      supported
        ? null
        : !secure
          ? "Microphone recording requires a secure page. Open PrepPilot using https:// or http://localhost, not a local-network HTTP address."
          : !hasMediaDevices
            ? "Microphone access is unavailable in this embedded browser or preview. Open PrepPilot in a normal Chrome or Edge tab and allow microphone access for the site."
            : "This browser does not provide the MediaRecorder API. Open PrepPilot in a current version of Chrome, Edge, Firefox, or Safari.",
    );
    setSupportChecked(true);
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

  const discardActiveRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
    try {
      recorder.stop();
    } catch {
      /* The stream cleanup below still releases the microphone. */
    }
  }, []);

  const reset = useCallback(() => {
    startRequestRef.current += 1;
    startInProgressRef.current = false;
    discardActiveRecorder();
    cleanupRecording();
    setIsRecording(false);
    setElapsedSeconds(0);
    setError(null);
    setRecordedFile(null);
    setRecordingDurationSeconds(null);
    setHasRecording(false);
    setPreview(null);
  }, [cleanupRecording, discardActiveRecorder, setPreview]);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      startRequestRef.current += 1;
      startInProgressRef.current = false;
      discardActiveRecorder();
      cleanupRecording();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [cleanupRecording, discardActiveRecorder]);

  const createFileFromBlob = useCallback((blob: Blob) => {
    const extension = blob.type.includes("ogg") ? "ogg" : "webm";
    return new File([blob], `interview-answer-${Date.now()}.${extension}`, {
      type: blob.type || "audio/webm",
    });
  }, []);

  const start = useCallback(async () => {
    if (startInProgressRef.current || !isSupported || isRecording) {
      return false;
    }

    const requestId = ++startRequestRef.current;
    startInProgressRef.current = true;
    setError(null);
    setRecordedFile(null);
    setRecordingDurationSeconds(null);
    setHasRecording(false);
    setPreview(null);

    try {
      if (
        typeof window === "undefined" ||
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new DOMException(
          "Media devices are unavailable in this browser.",
          "NotSupportedError",
        );
      }

      const mediaRequest = navigator.mediaDevices.getUserMedia({ audio: true });
      void mediaRequest
        .then((lateStream) => {
          if (!isMountedRef.current || startRequestRef.current !== requestId) {
            lateStream.getTracks().forEach((track) => track.stop());
          }
        })
        .catch(() => {
          /* The awaited request below handles the visible error. */
        });

      let timeoutId: number | undefined;
      const timeout = new Promise<MediaStream>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(
            new Error(
              "Microphone access is taking too long. Check the browser's site permissions, then retry.",
            ),
          );
        }, 12_000);
      });
      let stream: MediaStream;
      try {
        stream = await Promise.race([mediaRequest, timeout]);
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      }

      if (!isMountedRef.current || startRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      const mimeType = mimeTypeRef.current;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        setError(
          event.error ? formatMediaError(event.error) : "Recording failed. Please try again.",
        );
        setIsRecording(false);
        cleanupRecording();
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

        const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        const file = createFileFromBlob(blob);
        setRecordedFile(file);
        setRecordingDurationSeconds(durationSeconds);
        setHasRecording(true);
        setPreview(URL.createObjectURL(blob));
        cleanupRecording();
      };

      recorderRef.current = recorder;
      streamRef.current = stream;
      startTimeRef.current = Date.now();
      recorder.start();
      setElapsedSeconds(0);
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000)));
      }, 250);
      return true;
    } catch (error) {
      if (startRequestRef.current !== requestId || !isMountedRef.current) return false;
      startInProgressRef.current = false;
      startRequestRef.current += 1;
      setError(formatMediaError(error));
      stopStreamTracks();
      cleanupRecording();
      setIsRecording(false);
      return false;
    } finally {
      if (startRequestRef.current === requestId) startInProgressRef.current = false;
    }
  }, [
    cleanupRecording,
    createFileFromBlob,
    isRecording,
    isSupported,
    setPreview,
    stopStreamTracks,
  ]);

  const cancelStart = useCallback(() => {
    startRequestRef.current += 1;
    startInProgressRef.current = false;
  }, []);

  const stop = useCallback(() => {
    if (!isRecording || !recorderRef.current) {
      return;
    }

    try {
      recorderRef.current.stop();
    } catch (error) {
      setError(formatMediaError(error));
      stopStreamTracks();
      cleanupRecording();
      setIsRecording(false);
    }

    setIsRecording(false);
  }, [cleanupRecording, isRecording, stopStreamTracks]);

  return {
    isSupported,
    supportChecked,
    supportError,
    isRecording,
    hasRecording,
    elapsedSeconds,
    error,
    recordedFile,
    recordingDurationSeconds,
    previewUrl,
    start,
    cancelStart,
    stop,
    reset,
  } as RecordingState & {
    start: () => Promise<boolean>;
    cancelStart: () => void;
    stop: () => void;
    reset: () => void;
  };
}
