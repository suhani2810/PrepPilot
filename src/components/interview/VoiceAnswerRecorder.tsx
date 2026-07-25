import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, Volume2, VolumeX } from "lucide-react";
import { useVoiceRecorder } from "./useVoiceRecorder";

export type VoiceFlowState =
  | "ready"
  | "speaking-question"
  | "requesting-microphone"
  | "recording"
  | "transcribing"
  | "evaluating"
  | "preparing-next-question"
  | "error"
  | "completed";

type VoiceErrorKind = "microphone" | "transcription" | "submission" | null;

export type VoiceAnswerRecorderProps = {
  currentQuestionId?: string;
  currentQuestion?: string;
  introduction?: string;
  introductionPending?: boolean;
  onIntroductionComplete?: () => void;
  closingMessage?: string;
  closingPending?: boolean;
  onClosingComplete?: () => void;
  disabled?: boolean;
  flowState?: VoiceFlowState;
  onRecordingReset?: () => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onFlowStateChange?: (state: VoiceFlowState) => void;
  onQuestionSpoken?: () => void;
  onSubmitAnswer?: (transcript: string) => Promise<void>;
  onSwitchToText?: () => void;
};

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function getEnglishVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => /^en(-|_)/i.test(voice.lang) && voice.localService) ??
    voices.find((voice) => /^en(-|_)/i.test(voice.lang))
  );
}

export function VoiceAnswerRecorder({
  currentQuestionId,
  currentQuestion,
  introduction,
  introductionPending = false,
  onIntroductionComplete,
  closingMessage,
  closingPending = false,
  onClosingComplete,
  disabled,
  flowState = "ready",
  onRecordingReset,
  onRecordingStateChange,
  onFlowStateChange,
  onQuestionSpoken,
  onSubmitAnswer,
  onSwitchToText,
}: VoiceAnswerRecorderProps) {
  const {
    isSupported,
    supportChecked,
    supportError,
    isRecording,
    hasRecording,
    elapsedSeconds,
    error: recorderError,
    recordedFile,
    recordingDurationSeconds,
    start,
    cancelStart,
    stop,
    reset,
  } = useVoiceRecorder({ onRecordingStateChange });

  const [errorKind, setErrorKind] = useState<VoiceErrorKind>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [cachedTranscript, setCachedTranscript] = useState<string | null>(null);
  const [ttsSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined",
  );

  const abortControllerRef = useRef<AbortController | null>(null);
  const autoProcessRef = useRef(false);
  const finishInProgressRef = useRef(false);
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const startAttemptRef = useRef(0);
  const speechGenerationRef = useRef(0);
  const spokenIntroductionRef = useRef<string | null>(null);
  const spokenClosingRef = useRef<string | null>(null);
  const spokenQuestionRef = useRef<string | null>(null);

  const questionKey = currentQuestionId ?? currentQuestion ?? null;
  const isBusy =
    flowState === "requesting-microphone" ||
    flowState === "transcribing" ||
    flowState === "evaluating" ||
    flowState === "preparing-next-question";

  const cancelSpeech = useCallback(() => {
    speechGenerationRef.current += 1;
    if (ttsSupported) window.speechSynthesis.cancel();
  }, [ttsSupported]);

  const speakText = useCallback(
    (text: string, onComplete?: () => void) => {
      if (!ttsSupported) {
        onFlowStateChange?.("ready");
        onComplete?.();
        return;
      }
      cancelSpeech();
      const speechGeneration = speechGenerationRef.current;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      const voice = getEnglishVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        if (isMountedRef.current && speechGenerationRef.current === speechGeneration) {
          onFlowStateChange?.("speaking-question");
        }
      };
      const finishSpeaking = () => {
        if (isMountedRef.current && speechGenerationRef.current === speechGeneration) {
          onFlowStateChange?.("ready");
          onComplete?.();
        }
      };
      utterance.onend = finishSpeaking;
      utterance.onerror = finishSpeaking;
      window.speechSynthesis.speak(utterance);
    },
    [cancelSpeech, onFlowStateChange, ttsSupported],
  );

  const speakQuestion = useCallback(
    (automatic = false) => {
      if (!currentQuestion?.trim() || isRecording || isBusy || (disabled && !automatic)) {
        if (automatic && !ttsSupported) onFlowStateChange?.("ready");
        return;
      }
      speakText(currentQuestion, onQuestionSpoken);
    },
    [
      currentQuestion,
      disabled,
      isBusy,
      isRecording,
      onFlowStateChange,
      onQuestionSpoken,
      speakText,
      ttsSupported,
    ],
  );

  useEffect(() => {
    if (!closingPending) return;
    cancelStart();
    abortControllerRef.current?.abort();
    reset();
    if (!closingMessage?.trim()) {
      onClosingComplete?.();
      return;
    }
    if (spokenClosingRef.current === closingMessage) return;
    spokenClosingRef.current = closingMessage;
    speakText(closingMessage, onClosingComplete);
  }, [cancelStart, closingMessage, closingPending, onClosingComplete, reset, speakText]);

  useEffect(() => {
    if (closingPending || !introductionPending) return;
    if (!introduction?.trim()) {
      onIntroductionComplete?.();
      return;
    }
    if (spokenIntroductionRef.current === introduction) return;
    spokenIntroductionRef.current = introduction;
    speakText(introduction, onIntroductionComplete);
  }, [closingPending, introduction, introductionPending, onIntroductionComplete, speakText]);

  useEffect(() => {
    if (introductionPending || closingPending) return;
    if (!questionKey || !currentQuestion || spokenQuestionRef.current === questionKey) return;
    if (flowState !== "ready" && flowState !== "speaking-question") return;
    spokenQuestionRef.current = questionKey;
    speakQuestion(true);
  }, [closingPending, currentQuestion, flowState, introductionPending, questionKey, speakQuestion]);

  useEffect(() => {
    if (!recorderError) return;
    setErrorKind("microphone");
    onFlowStateChange?.("error");
  }, [onFlowStateChange, recorderError]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      spokenIntroductionRef.current = null;
      spokenClosingRef.current = null;
      spokenQuestionRef.current = null;
      abortControllerRef.current?.abort();
      cancelSpeech();
    };
  }, [cancelSpeech]);

  useEffect(() => {
    if (flowState !== "completed") return;
    abortControllerRef.current?.abort();
    cancelSpeech();
    reset();
  }, [cancelSpeech, flowState, reset]);

  const clearTemporaryAnswer = useCallback(() => {
    setErrorKind(null);
    setTranscriptionError(null);
    setSubmissionError(null);
    setCachedTranscript(null);
    autoProcessRef.current = false;
    finishInProgressRef.current = false;
    reset();
    onRecordingReset?.();
  }, [onRecordingReset, reset]);

  const processAnswer = useCallback(
    async (audioFile: File | null, transcriptOverride?: string) => {
      if (inFlightRef.current || disabled || isBusy) return;
      inFlightRef.current = true;
      let transcript = transcriptOverride ?? cachedTranscript;

      try {
        if (!transcript) {
          if (!audioFile || audioFile.size === 0) {
            setErrorKind("transcription");
            setTranscriptionError("No usable recorded audio was found. Record your answer again.");
            onFlowStateChange?.("error");
            return;
          }
          if (
            !/^(audio\/|video\/)/.test(audioFile.type) &&
            !audioFile.name.match(/\.(wav|webm|ogg|mp3|m4a|mp4)$/i)
          ) {
            setErrorKind("transcription");
            setTranscriptionError(
              "The recording format is not supported. Record your answer again.",
            );
            onFlowStateChange?.("error");
            return;
          }
          if (audioFile.size > 25 * 1024 * 1024) {
            setErrorKind("transcription");
            setTranscriptionError(
              "The recording is too large. Record a shorter answer and try again.",
            );
            onFlowStateChange?.("error");
            return;
          }

          setErrorKind(null);
          setTranscriptionError(null);
          setSubmissionError(null);
          onFlowStateChange?.("transcribing");

          abortControllerRef.current?.abort();
          const controller = new AbortController();
          abortControllerRef.current = controller;

          try {
            const formData = new FormData();
            formData.append("audio", audioFile);
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;
            const response = await fetch("/api/transcribe", {
              method: "POST",
              body: formData,
              signal: controller.signal,
              headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });
            const responseText = await response.text();
            let payload: { transcript?: unknown; error?: string };

            try {
              payload = JSON.parse(responseText);
            } catch {
              throw new Error(
                "The transcription service returned an invalid response. Please retry.",
              );
            }

            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                throw new Error("You are not authorized to transcribe. Sign in again and retry.");
              }
              if (response.status === 429) {
                throw new Error("The transcription service is busy. Wait a moment and retry.");
              }
              if (response.status >= 500) {
                throw new Error("The transcription service is unavailable. Please retry shortly.");
              }
              throw new Error(payload.error || "Transcription failed.");
            }
            if (typeof payload.transcript !== "string" || !payload.transcript.trim()) {
              throw new Error("The transcription was empty. Record your answer again.");
            }
            transcript = payload.transcript.trim();
            if (isMountedRef.current) setCachedTranscript(transcript);
          } catch (error) {
            if (
              controller.signal.aborted ||
              (error instanceof DOMException && error.name === "AbortError")
            ) {
              return;
            }
            if (!isMountedRef.current) return;
            setErrorKind("transcription");
            setTranscriptionError(
              error instanceof Error ? error.message : "Transcription failed. Please retry.",
            );
            onFlowStateChange?.("error");
            return;
          } finally {
            if (abortControllerRef.current === controller) abortControllerRef.current = null;
          }
        }

        if (!transcript) return;
        try {
          setErrorKind(null);
          setSubmissionError(null);
          onFlowStateChange?.("evaluating");
          await onSubmitAnswer?.(transcript);
          if (!isMountedRef.current) return;
          clearTemporaryAnswer();
        } catch (error) {
          if (!isMountedRef.current) return;
          setErrorKind("submission");
          setSubmissionError(
            error instanceof Error
              ? error.message
              : "Your answer could not be evaluated. Retry with the saved transcript.",
          );
          onFlowStateChange?.("error");
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [cachedTranscript, clearTemporaryAnswer, disabled, isBusy, onFlowStateChange, onSubmitAnswer],
  );

  useEffect(() => {
    if (!autoProcessRef.current || !recordedFile || recordingDurationSeconds == null) return;
    autoProcessRef.current = false;
    finishInProgressRef.current = false;
    void processAnswer(recordedFile);
  }, [processAnswer, recordedFile, recordingDurationSeconds]);

  const handleStart = async () => {
    if (
      disabled ||
      isBusy ||
      isRecording ||
      inFlightRef.current
    )
      return;
    cancelSpeech();
    setErrorKind(null);
    setTranscriptionError(null);
    setSubmissionError(null);
    const attempt = ++startAttemptRef.current;
    onFlowStateChange?.("requesting-microphone");
    const started = await start();
    if (attempt !== startAttemptRef.current) return;
    if (started && isMountedRef.current) {
      onFlowStateChange?.("recording");
    } else if (isMountedRef.current) {
      setErrorKind("microphone");
      onFlowStateChange?.("error");
    }
  };

  const handleCancelMicrophone = () => {
    startAttemptRef.current += 1;
    cancelStart();
    onFlowStateChange?.("ready");
  };

  const handleSwitchToText = () => {
    handleCancelMicrophone();
    onSwitchToText?.();
  };

  const handleFinish = () => {
    if (!isRecording || finishInProgressRef.current || inFlightRef.current) return;
    finishInProgressRef.current = true;
    autoProcessRef.current = true;
    stop();
  };

  const handleRecordAgain = () => {
    if (inFlightRef.current) return;
    clearTemporaryAnswer();
    onFlowStateChange?.("ready");
  };

  const status = useMemo(() => {
    if (closingPending)
      return ["Closing your interview…", "Your performance report will be prepared next."];
    if (introductionPending)
      return ["Welcome to your interview", "Listen to the introduction before we begin."];
    if (flowState === "speaking-question")
      return ["Asking your question…", "Listen, then start when you are ready."];
    if (flowState === "requesting-microphone")
      return ["Connecting your microphone…", "Allow microphone access if your browser asks."];
    if (flowState === "recording")
      return ["Listening…", "Finish your answer when you are done speaking."];
    if (flowState === "transcribing")
      return ["Transcribing your response…", "Your recording is being converted to text."];
    if (flowState === "evaluating")
      return [
        "Evaluating your answer…",
        "PrepPilot is using the existing interview evaluation pipeline.",
      ];
    if (flowState === "preparing-next-question")
      return ["Preparing your next question…", "Your adaptive follow-up is being loaded."];
    if (flowState === "error")
      return ["Your answer needs attention", "Use the recovery option below to continue."];
    if (flowState === "completed") return ["Interview complete", "Your report is being prepared."];
    return ["Ready for your answer", "Click Start Answer when you are ready to speak."];
  }, [closingPending, flowState, introductionPending]);

  return (
    <div className="w-full rounded-xl border border-border/70 bg-secondary/30 p-5 text-left">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {flowState === "recording" ? (
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/30" />
              <Mic className="relative h-5 w-5" />
            </span>
          ) : isBusy || flowState === "speaking-question" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground" aria-live="polite">
            {status[0]}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">{status[1]}</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {flowState === "recording"
                ? "Listening"
                : flowState === "requesting-microphone"
                  ? "Connecting"
                  : isBusy
                    ? "Processing"
                    : flowState === "error"
                      ? "Needs retry"
                      : "Ready"}
            </Badge>
            {flowState === "recording" && (
              <>
                <span
                  className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive"
                  aria-hidden="true"
                />
                <span className="rounded-full bg-background/80 px-2 py-1 font-mono text-xs">
                  {formatTimer(elapsedSeconds)}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {flowState === "requesting-microphone" && (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelMicrophone}>
                  Cancel
                </Button>
                {onSwitchToText && (
                  <Button variant="outline" size="sm" onClick={handleSwitchToText}>
                    Switch to Text mode
                  </Button>
                )}
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => speakQuestion(false)}
              disabled={
                !ttsSupported ||
                !currentQuestion ||
                flowState === "recording" ||
                isBusy ||
                disabled ||
                introductionPending ||
                closingPending
              }
              aria-label="Replay current interview question"
              title={
                ttsSupported ? "Replay Question" : "Question speech is unavailable in this browser"
              }
            >
              {ttsSupported ? (
                <Volume2 className="mr-1.5 h-4 w-4" />
              ) : (
                <VolumeX className="mr-1.5 h-4 w-4" />
              )}
              Replay Question
            </Button>

            {!introductionPending &&
            !closingPending &&
            (flowState === "ready" || flowState === "speaking-question") ? (
              <Button
                onClick={() => void handleStart()}
                disabled={!supportChecked || !isSupported || disabled || inFlightRef.current}
              >
                <Mic className="mr-1.5 h-4 w-4" /> Start Answer
              </Button>
            ) : null}
            {flowState === "recording" && (
              <Button
                variant="destructive"
                onClick={handleFinish}
                disabled={!isRecording || finishInProgressRef.current}
              >
                Finish Answer
              </Button>
            )}
          </div>
        </div>

        {!ttsSupported && (
          <p className="text-xs text-muted-foreground">
            Question speech is unavailable in this browser. Voice answers will still work.
          </p>
        )}

        {((supportChecked && !isSupported) || errorKind === "microphone") && (
          <div
            className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            role="alert"
          >
            <div>
              <p className="font-semibold">Microphone access needed</p>
              <p>
                {recorderError ??
                  supportError ??
                  "Microphone recording is unavailable. Check this site's microphone permission and try again."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isSupported && (
                <Button variant="secondary" size="sm" onClick={() => void handleStart()}>
                  Retry microphone access
                </Button>
              )}
              {onSwitchToText && (
                <Button variant="outline" size="sm" onClick={handleSwitchToText}>
                  Switch to Text mode
                </Button>
              )}
            </div>
          </div>
        )}

        {errorKind === "transcription" && transcriptionError && (
          <div
            className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            role="alert"
          >
            <div>
              <p className="font-semibold">Transcription error</p>
              <p>{transcriptionError}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void processAnswer(recordedFile)}
              >
                Retry
              </Button>
              <Button variant="outline" size="sm" onClick={handleRecordAgain}>
                Record Answer Again
              </Button>
            </div>
          </div>
        )}

        {errorKind === "submission" && submissionError && cachedTranscript && (
          <div
            className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            role="alert"
          >
            <div>
              <p className="font-semibold">Evaluation error</p>
              <p>{submissionError}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void processAnswer(recordedFile, cachedTranscript)}
            >
              Retry
            </Button>
          </div>
        )}

        {hasRecording && flowState === "error" && recordingDurationSeconds != null && (
          <p className="text-xs text-muted-foreground">
            Your {formatTimer(recordingDurationSeconds)} recording is kept temporarily for retry and
            is not permanently stored.
          </p>
        )}
      </div>
    </div>
  );
}
