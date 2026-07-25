import Groq, { AuthenticationError, APIError, RateLimitError } from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

async function verifyAuth(request: Request): Promise<{ userId: string } | Response> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return jsonError("Server configuration error: Supabase env missing.", 500);
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError("Unauthorized", 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) {
    return jsonError("Unauthorized", 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (
          isNewSupabaseApiKey(SUPABASE_PUBLISHABLE_KEY) &&
          headers.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
        ) {
          headers.delete("Authorization");
        }
        headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return jsonError("Unauthorized", 401);
    }
    return { userId: data.claims.sub as string };
  } catch {
    return jsonError("Unauthorized", 401);
  }
}

const MAX_AUDIO_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
  "audio/m4a",
]);
const ALLOWED_AUDIO_EXTENSIONS = new Set([
  ".webm",
  ".ogg",
  ".mp3",
  ".mpeg",
  ".mp4",
  ".wav",
  ".m4a",
]);

export type TranscriptionResponse = {
  transcript: string;
  durationSeconds: number | null;
  language: string | null;
  segments: Array<{ id?: number; start: number; end: number; text: string }>;
  words: Array<{ word: string; start: number; end: number }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function getFileExtension(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

function isAcceptedAudioFile(file: File) {
  const fileType = file.type.toLowerCase();
  const extension = getFileExtension(file.name);
  return ALLOWED_AUDIO_MIME_TYPES.has(fileType) || ALLOWED_AUDIO_EXTENSIONS.has(extension);
}

function normalizeTranscriptResponse(data: any): TranscriptionResponse {
  const transcript = typeof data.text === "string" ? data.text : "";
  const durationSeconds =
    typeof data.duration === "number"
      ? data.duration
      : typeof data.duration_seconds === "number"
        ? data.duration_seconds
        : null;
  const language = typeof data.language === "string" ? data.language : null;
  const segments = Array.isArray(data.segments)
    ? data.segments.map((segment: any) => ({
        id: typeof segment.id === "number" ? segment.id : undefined,
        start: typeof segment.start === "number" ? segment.start : 0,
        end: typeof segment.end === "number" ? segment.end : 0,
        text: typeof segment.text === "string" ? segment.text : "",
      }))
    : [];
  const words = Array.isArray(data.words)
    ? data.words.map((word: any) => ({
        word: typeof word.word === "string" ? word.word : "",
        start: typeof word.start === "number" ? word.start : 0,
        end: typeof word.end === "number" ? word.end : 0,
      }))
    : [];

  return {
    transcript,
    durationSeconds,
    language,
    segments,
    words,
  };
}

export async function handleTranscribeRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed. Use POST.", 405);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonError("Invalid Content-Type. Expected multipart/form-data.", 415);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return jsonError("Invalid multipart/form-data request.", 400);
  }

  const audioValue = formData.get("audio");
  if (!(audioValue instanceof File)) {
    return jsonError('Missing or invalid "audio" file upload.', 400);
  }

  const audioFile = audioValue as File;
  if (audioFile.size === 0) {
    return jsonError("Uploaded audio file is empty.", 400);
  }

  if (audioFile.size > MAX_AUDIO_FILE_SIZE_BYTES) {
    return jsonError("Uploaded audio file is too large. Maximum size is 25 MB.", 413);
  }

  if (!isAcceptedAudioFile(audioFile)) {
    return jsonError(
      "Unsupported audio file type. Supported types: webm, wav, mpeg, mp4, ogg, x-m4a.",
      415,
    );
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return jsonError("Server configuration error: GROQ_API_KEY is missing.", 500);
  }

  const client = new Groq({ apiKey });

  let transcriptionResponse: any;

  try {
    transcriptionResponse = await client.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3-turbo",
      language: "en",
      response_format: "verbose_json",
      temperature: 0,
      timestamp_granularities: ["segment", "word"],
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return jsonError("Groq authentication failed. Check server GROQ_API_KEY.", 502);
    }
    if (error instanceof RateLimitError) {
      return jsonError("Groq rate limit exceeded. Please try again later.", 429);
    }
    if (error instanceof APIError) {
      return jsonError("Groq service error. Please try again later.", 502);
    }
    const message = error instanceof Error ? error.message : "Unexpected transcription error.";
    return jsonError(message, 500);
  }

  if (!transcriptionResponse || typeof transcriptionResponse !== "object") {
    return jsonError("Transcription service returned an invalid response.", 502);
  }

  const normalized = normalizeTranscriptResponse(transcriptionResponse);
  if (!normalized.transcript) {
    return jsonError("Transcription returned an empty transcript.", 502);
  }

  return jsonResponse(normalized);
}
