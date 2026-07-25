import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic } from "lucide-react";
import { useVoiceRecorder } from "./useVoiceRecorder";

export type VoiceAnswerRecorderProps = {
  disabled?: boolean;
  onRecordingReady?: (file: File, durationSeconds: number) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
};

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function VoiceAnswerRecorder({ disabled, onRecordingReady, onRecordingStateChange }: VoiceAnswerRecorderProps) {
  const {
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
  } = useVoiceRecorder({
    onRecordingStateChange,
  });

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<{
    transcript: string;
    durationSeconds: number | null;
    language: string | null;
  } | null>(null);

  const recordingLabel = useMemo(() => {
    if (!isSupported) return "Audio recording is not supported in this browser.";
    if (error) return error;
    if (isRecording) return "Recording your answer…";
    if (hasRecording) return "Review your recorded answer.";
    return "Ready to record your answer.";
  }, [error, hasRecording, isRecording, isSupported]);

  const handleUseRecording = async () => {
    if (!recordedFile || recordingDurationSeconds == null) return;
    onRecordingReady?.(recordedFile, recordingDurationSeconds);
    console.log("Voice recording ready");
  };

  const handleRecordAgain = () => {
    setTranscriptionError(null);
    setTranscriptionResult(null);
    reset();
  };

  const handleTestTranscription = async () => {
    if (!recordedFile || isTranscribing) return;
    setTranscriptionError(null);
    setTranscriptionResult(null);
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("audio", recordedFile);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const text = await response.text();
      let payload: any;

      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("Invalid server response.");
      }

      if (!response.ok) {
        throw new Error(payload?.error || `Transcription failed with status ${response.status}.`);
      }

      if (!payload?.transcript) {
        throw new Error("Transcription returned an empty transcript.");
      }

      setTranscriptionResult({
        transcript: payload.transcript,
        durationSeconds: payload.durationSeconds ?? null,
        language: payload.language ?? null,
      });
    } catch (error) {
      setTranscriptionError(error instanceof Error ? error.message : "Transcription failed.");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="w-full rounded-xl border border-border/70 bg-secondary/30 p-5 text-left">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Mic className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground">{recordingLabel}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">Use your microphone to record one spoken answer. Playback is available after you stop recording.</p>
        </div>
      </div>

      {!isSupported ? (
        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Your browser does not support audio recording via MediaRecorder.</div>
      ) : (
        <div className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{isRecording ? "Recording" : hasRecording ? "Recorded" : "Ready"}</Badge>
                {isRecording && <span className="inline-flex h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" aria-hidden="true" />}
                {!isRecording && hasRecording && recordingDurationSeconds != null && (
                  <span>{`Duration ${formatTimer(recordingDurationSeconds)}`}</span>
                )}
              </div>
              {isRecording && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <span className="rounded-full bg-background/80 px-2 py-1 font-mono text-xs">{formatTimer(elapsedSeconds)}</span>
                  <span className="text-muted-foreground">elapsed</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!isRecording && !hasRecording && (
                <Button
                  variant="secondary"
                  onClick={start}
                  disabled={disabled}
                  aria-label="Start recording answer"
                >
                  Start Recording
                </Button>
              )}
              {isRecording && (
                <Button
                  variant="destructive"
                  onClick={stop}
                  aria-label="Stop recording answer"
                >
                  Stop Recording
                </Button>
              )}
              {hasRecording && (
                <Button
                  variant="outline"
                  onClick={handleRecordAgain}
                  aria-label="Record again"
                >
                  Record Again
                </Button>
              )}
              {hasRecording && (
                <Button
                  variant="secondary"
                  onClick={handleTestTranscription}
                  disabled={isTranscribing}
                  aria-label="Test transcription"
                >
                  {isTranscribing ? "Transcribing…" : "Test Transcription"}
                </Button>
              )}
              {hasRecording && (
                <Button
                  onClick={handleUseRecording}
                  aria-label="Use recording"
                >
                  Use Recording
                </Button>
              )}
            </div>
          </div>

          {hasRecording && previewUrl && (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Audio preview</p>
              <audio controls className="w-full" aria-label="Recorded answer playback">
                <source src={previewUrl} type={recordedFile?.type ?? "audio/webm"} />
                Your browser does not support audio playback for this recording.
              </audio>
              <div className="text-xs text-muted-foreground">Recorded duration: {formatTimer(recordingDurationSeconds ?? 0)}</div>
            </div>
          )}

          {transcriptionError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-semibold">Transcription error</p>
              <p>{transcriptionError}</p>
            </div>
          )}

          {transcriptionResult && (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Transcription result</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{transcriptionResult.transcript}</p>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Language: {transcriptionResult.language ?? "unknown"}</span>
                <span>Duration: {transcriptionResult.durationSeconds != null ? formatTimer(Math.round(transcriptionResult.durationSeconds)) : "unknown"}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
