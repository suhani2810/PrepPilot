import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { analyzeFillerWords } from "@/lib/filler-words";
import { getAIModels } from "./ai.server";
import type { Json } from "@/integrations/supabase/types";

const asJson = (v: unknown) => v as unknown as Json;

// -------- helpers ------------------------------------------------
function stripJsonFence(s: string): string {
  return s
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}
function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    /* Try the cleaned response below. */
  }
  const cleaned = stripJsonFence(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* Try extracting the first JSON object below. */
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1)) as T;
    } catch {
      /* The response does not contain parseable JSON. */
    }
  }
  return null;
}

async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  fallback: T;
  timeoutMs?: number;
}): Promise<T> {
  const models = getAIModels();
  const system = opts.system + "\nReturn ONLY valid JSON. No prose, no markdown.";
  let lastErr: unknown = null;
  for (const { name, model } of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);
    try {
      const { text } = await generateText({
        model,
        system,
        prompt: opts.prompt,
        abortSignal: controller.signal,
      });
      const parsed = safeJsonParse<unknown>(text);
      const validated = opts.schema.safeParse(parsed);
      return validated.success ? validated.data : opts.fallback;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        const parsed = safeJsonParse<unknown>(err.text ?? "");
        const validated = opts.schema.safeParse(parsed);
        if (validated.success) return validated.data;
      }
      lastErr = err;
      if (controller.signal.aborted) {
        lastErr = new Error(`AI request timed out via ${name}.`);
      }
      // fall through and try next provider
    } finally {
      clearTimeout(timeout);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`AI request failed: ${msg}`);
}

type RateLimitAction = "parse_resume" | "start_interview" | "submit_answer" | "roadmap";

async function enforceRateLimit(userId: string, action: RateLimitAction) {
  // Rate limiting is enforced server-side only: the RPC is executable by the
  // service role, never by signed-in users.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rateLimitClient = supabaseAdmin as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await rateLimitClient.rpc("consume_rate_limit", {
    p_action: action,
    p_user_id: userId,
  });
  if (error) {
    console.error(`[security] ${action} rate-limit check failed`, error);
    throw new Error("Security controls are unavailable. Please retry shortly.");
  }
  if (data !== true) throw new Error("Too many requests. Please wait before trying again.");
}

async function getTrustedDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const limitedText = (max: number) => z.string().trim().max(max);
const resumeProfileSchema = z.object({
  summary: limitedText(4_000),
  education: z
    .array(
      z.object({
        degree: limitedText(300),
        institution: limitedText(300),
        year: limitedText(100),
      }),
    )
    .max(20),
  skills: z.array(limitedText(200)).max(100),
  frameworks: z.array(limitedText(200)).max(100),
  languages: z.array(limitedText(200)).max(100),
  projects: z
    .array(
      z.object({
        name: limitedText(300),
        description: limitedText(4_000),
        technologies: z.array(limitedText(200)).max(50),
        possibleInterviewTopics: z.array(limitedText(300)).max(50),
      }),
    )
    .max(30),
  experience: z
    .array(
      z.object({
        role: limitedText(300),
        company: limitedText(300),
        duration: limitedText(200),
        highlights: z.array(limitedText(1_000)).max(50),
      }),
    )
    .max(30),
  strengthAreas: z.array(limitedText(300)).max(50),
  potentialQuestionAreas: z.array(limitedText(300)).max(50),
});

// -------- 1. Parse resume --------------------------------------------------
export const parseResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { resumePath: string }) =>
    z.object({ resumePath: z.string().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit(supabase, "parse_resume");
    if (!data.resumePath.startsWith(`${userId}/`)) throw new Error("Invalid resume path");
    const { data: file, error: dlErr } = await supabase.storage
      .from("resumes")
      .download(data.resumePath);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download resume");
    if (file.size > 10 * 1024 * 1024) throw new Error("Resume must be 10 MB or smaller");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (
      bytes.length < 5 ||
      bytes[0] !== 0x25 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x44 ||
      bytes[3] !== 0x46 ||
      bytes[4] !== 0x2d
    ) {
      throw new Error("The uploaded file is not a valid PDF");
    }
    const { extractPdfText } = await import("./pdf.server");
    const resumeText = (await extractPdfText(bytes)).slice(0, 60_000);

    const parsed = await generateJson({
      system:
        "You are an expert technical recruiter. Extract structured candidate information from a resume for mock interview preparation.",
      prompt: `Resume text:\n"""\n${resumeText}\n"""\n\nReturn JSON with this exact shape:\n{
  "summary": string,
  "education": [{ "degree": string, "institution": string, "year": string }],
  "skills": string[],
  "frameworks": string[],
  "languages": string[],
  "projects": [{ "name": string, "description": string, "technologies": string[], "possibleInterviewTopics": string[] }],
  "experience": [{ "role": string, "company": string, "duration": string, "highlights": string[] }],
  "strengthAreas": string[],
  "potentialQuestionAreas": string[]
}`,
      schema: resumeProfileSchema,
      fallback: {
        summary: "",
        education: [],
        skills: [],
        frameworks: [],
        languages: [],
        projects: [],
        experience: [],
        strengthAreas: [],
        potentialQuestionAreas: [],
      },
    });
    const parsedJson = parsed as unknown as import("@/integrations/supabase/types").Json;

    const db = await getTrustedDb();
    const { data: existing } = await db
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await db
        .from("candidate_profiles")
        .update({
          resume_path: data.resumePath,
          resume_text: resumeText,
          parsed: parsedJson,
        })
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: inserted, error } = await db
      .from("candidate_profiles")
      .insert({
        user_id: userId,
        resume_path: data.resumePath,
        resume_text: resumeText,
        parsed: parsedJson,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

// -------- 2. Update parsed profile (user edits) ----------------------------
export const updateCandidateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; parsed: unknown }) =>
    z
      .object({
        id: z.string().uuid(),
        parsed: resumeProfileSchema.refine(
          (value) => JSON.stringify(value).length <= 100_000,
          "Candidate profile is too large",
        ),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await getTrustedDb();
    const { error } = await db
      .from("candidate_profiles")
      .update({ parsed: asJson(data.parsed) })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- 3. Start interview: build plan + first question ------------------
export const startInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      role: string;
      experienceLevel: string;
      interviewTypes: string[];
      jobDescription?: string;
      durationMinutes: number;
      interviewMode: "voice" | "text";
    }) =>
      z
        .object({
          role: z.string().trim().min(1).max(120),
          experienceLevel: z.string().trim().min(1).max(80),
          interviewTypes: z.array(z.string().trim().min(1).max(80)).min(1).max(5),
          jobDescription: z.string().trim().max(20_000).optional(),
          durationMinutes: z.number().int().min(5).max(180),
          interviewMode: z.enum(["voice", "text"]),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit(supabase, "start_interview");
    const db = await getTrustedDb();
    const [{ data: cp }, { data: profile }] = await Promise.all([
      db.from("candidate_profiles").select("id").eq("user_id", userId).maybeSingle(),
      db.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    ]);

    const candidateFirstName = profile?.display_name?.trim().split(/\s+/)[0];
    // Starting an interview must not depend on an external AI provider. The
    // adaptive interviewer still generates all subsequent turns from the full
    // interview context after the candidate answers this opening question.
    const plan = {
      summary: `${data.experienceLevel} ${data.role} interview focused on ${data.interviewTypes.join(", ")}.`,
      topics: data.interviewTypes.map((name) => ({ name, weight: 3 })),
    };
    const first = {
      question: `Tell me about yourself and your experience relevant to a ${data.role} role.`,
      topic: "Background",
      difficulty: 2,
    };

    const focus = data.interviewTypes.join(", ");
    const introduction = [
      candidateFirstName ? `Hello ${candidateFirstName}.` : "Hello.",
      `Welcome to your ${data.role} mock interview.`,
      `Today's interview will last approximately ${data.durationMinutes} minutes.`,
      `We'll focus on ${focus}. I'll ask questions based on your resume, your selected interview focus, and your answers throughout the interview. Follow-up questions will adapt to what you share.`,
      "Feel free to take a moment to think before responding.",
      "We'll start with some questions about your background.",
      "Whenever you're ready, let's begin.",
    ].join("\n\n");
    const closingMessage = [
      "That brings us to the end of today's interview.",
      "Thank you for taking the time to answer my questions.",
      "I'm now reviewing your responses and preparing your performance report.",
    ].join("\n\n");

    const { data: interview, error: iErr } = await db
      .from("interviews")
      .insert({
        user_id: userId,
        candidate_profile_id: cp?.id ?? null,
        role: data.role,
        experience_level: data.experienceLevel,
        interview_types: data.interviewTypes,
        job_description: data.jobDescription ?? null,
        duration_minutes: data.durationMinutes,
        plan: asJson(plan),
        context: asJson({
          currentDifficulty: first.difficulty,
          topicsCovered: [first.topic],
          topicScores: {},
          interviewMode: data.interviewMode,
          introduction,
          closingMessage,
        }),
        status: "active",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);

    const { error: mErr } = await db.from("interview_messages").insert({
      interview_id: interview.id,
      role: "ai",
      content: first.question,
      topic: first.topic,
      difficulty: first.difficulty,
      order_index: 0,
    });
    if (mErr) throw new Error(mErr.message);

    return { interviewId: interview.id };
  });

// -------- 3b. Begin countdown after the introduction ----------------------
export const beginInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { interviewId: string }) =>
    z.object({ interviewId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const db = await getTrustedDb();
    const { data: interview, error: readError } = await db
      .from("interviews")
      .select("user_id, context, started_at")
      .eq("id", data.interviewId)
      .single();
    if (readError || !interview) throw new Error(readError?.message ?? "Interview not found");
    if (interview.user_id !== userId) throw new Error("Forbidden");

    const interviewContext = (interview.context ?? {}) as Record<string, unknown>;
    const existingStart = interviewContext.interviewBeganAt;
    if (typeof existingStart === "string" && existingStart) {
      return { startedAt: existingStart };
    }

    const startedAt = new Date().toISOString();
    const { error: updateError } = await db
      .from("interviews")
      .update({
        started_at: startedAt,
        context: asJson({ ...interviewContext, interviewBeganAt: startedAt }),
      })
      .eq("id", data.interviewId)
      .eq("user_id", userId);
    if (updateError) throw new Error(updateError.message);
    return { startedAt };
  });

// -------- 4. Submit answer → evaluate + next question ---------------------
const scoreSchema = z.number().finite().min(0).max(10);
const feedbackItemsSchema = z.array(limitedText(500)).max(12);
const evalResultSchema = z.object({
  technicalAccuracy: scoreSchema,
  clarity: scoreSchema,
  relevance: scoreSchema,
  problemSolving: scoreSchema,
  communication: scoreSchema,
  overallScore: scoreSchema,
  strengths: feedbackItemsSchema,
  weaknesses: feedbackItemsSchema,
  missingConcepts: feedbackItemsSchema,
  idealAnswer: limitedText(8_000),
  recommendedFollowUp: limitedText(2_000),
});
type EvalResult = z.infer<typeof evalResultSchema>;

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { interviewId: string; answer: string }) =>
    z
      .object({
        interviewId: z.string().uuid(),
        answer: z.string().trim().min(1).max(10_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit(supabase, "submit_answer");
    const db = await getTrustedDb();

    const { data: interview, error: iErr } = await db
      .from("interviews")
      .select(
        "id, user_id, role, experience_level, interview_types, plan, context, candidate_profile_id, started_at, duration_minutes, status",
      )
      .eq("id", data.interviewId)
      .single();
    if (iErr || !interview) throw new Error(iErr?.message ?? "Interview not found");
    if (interview.user_id !== userId) throw new Error("Forbidden");
    if (interview.status !== "active") throw new Error("This interview is no longer active");
    const guardedContext = (interview.context ?? {}) as Record<string, unknown>;
    if (typeof guardedContext.interviewBeganAt !== "string") {
      throw new Error("Begin the interview before submitting an answer");
    }
    const deadlineMs =
      new Date(guardedContext.interviewBeganAt).getTime() +
      Math.max(5, Number(interview.duration_minutes ?? 30)) * 60_000;
    if (!Number.isFinite(deadlineMs) || Date.now() > deadlineMs + 60_000) {
      throw new Error("The interview time has expired");
    }

    const { data: cp } = interview.candidate_profile_id
      ? await db
          .from("candidate_profiles")
          .select("parsed")
          .eq("id", interview.candidate_profile_id)
          .eq("user_id", userId)
          .maybeSingle()
      : { data: null as { parsed: unknown } | null };

    const { data: msgs } = await db
      .from("interview_messages")
      .select("id, role, content, topic, difficulty, order_index")
      .eq("interview_id", data.interviewId)
      .order("order_index", { ascending: true });
    const messages = msgs ?? [];
    const lastAi = [...messages].reverse().find((m) => m.role === "ai");
    if (!lastAi) throw new Error("No pending question");

    const nextIdx = messages.length;

    // Store the user's answer
    const { data: userMsg, error: umErr } = await db
      .from("interview_messages")
      .insert({
        interview_id: data.interviewId,
        role: "user",
        content: data.answer,
        topic: lastAi.topic,
        difficulty: lastAi.difficulty,
        order_index: nextIdx,
      })
      .select("id")
      .single();
    if (umErr) throw new Error(umErr.message);

    const recent = messages
      .slice(-6)
      .map((m) => `${m.role === "ai" ? "Interviewer" : "Candidate"}: ${m.content}`)
      .join("\n");
    const durationSeconds = Math.max(1, Number(interview.duration_minutes ?? 30) * 60);
    const startedAtMs = interview.started_at
      ? new Date(interview.started_at).getTime()
      : Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
    const elapsedRatio = Math.min(1, elapsedSeconds / durationSeconds);
    const timePhase =
      remainingSeconds <= 60
        ? "final-minute"
        : remainingSeconds <= 5 * 60
          ? "near-end"
          : elapsedRatio < 0.25
            ? "beginning"
            : "middle";
    const answerWordCount = data.answer.trim().split(/\s+/).filter(Boolean).length;
    const interviewerTopics = messages.filter((message) => message.role === "ai" && message.topic);
    const currentTopicTurns = interviewerTopics.filter(
      (message) => message.topic === lastAi.topic,
    ).length;
    const recentSameTopicTurns = [...interviewerTopics]
      .reverse()
      .findIndex((message) => message.topic !== lastAi.topic);
    const consecutiveTopicTurns =
      recentSameTopicTurns === -1 ? interviewerTopics.length : recentSameTopicTurns;
    const ctx = (interview.context ?? {}) as {
      currentDifficulty?: number;
      topicsCovered?: string[];
      topicScores?: Record<string, number>;
      interviewMode?: "voice" | "text";
      introduction?: string;
      closingMessage?: string;
    };

    // Single call: evaluate privately AND generate the next conversational interviewer turn.
    type Combined = {
      evaluation: EvalResult;
      next: {
        acknowledgement: string;
        transition: string;
        question: string;
        topic: string;
        difficulty: number;
      };
    };
    const combinedSchema: z.ZodType<Combined> = z.object({
      evaluation: evalResultSchema,
      next: z.object({
        acknowledgement: limitedText(1_000),
        transition: limitedText(1_000),
        question: limitedText(2_000).min(1),
        topic: limitedText(200).min(1),
        difficulty: z.number().int().min(1).max(5),
      }),
    });
    const combined = await generateJson<Combined>({
      system:
        "You are an expert professional interviewer and a private evaluator. Evaluate the candidate's last answer internally, then produce one natural interviewer turn containing an acknowledgement, a transition, and the next adaptive question. The acknowledgement must be grounded in what the candidate actually said; use neutral or corrective language when praise is not earned. Adapt using the interview type, resume, and interview history. Avoid repeating acknowledgement or transition phrases from recent turns. Never reveal scores, evaluation details, hidden reasoning, or unsupported praise to the candidate.",
      prompt: `Candidate profile: ${JSON.stringify(cp?.parsed ?? {}).slice(0, 4000)}
Role: ${interview.role} (${interview.experience_level}). Types: ${(interview.interview_types ?? []).join(", ")}.
Plan topics: ${JSON.stringify(interview.plan)}
Current difficulty: ${ctx.currentDifficulty ?? 2}
Topics covered: ${(ctx.topicsCovered ?? []).join(", ")}
Time remaining: ${remainingSeconds} seconds (about ${Math.max(0, Math.ceil(remainingSeconds / 60))} minutes)
Interview phase: ${timePhase}
Elapsed portion: ${Math.round(elapsedRatio * 100)}%
Candidate answer length: ${answerWordCount} words
Current topic turns: ${currentTopicTurns} total, ${consecutiveTopicTurns} consecutive
Recent transcript:
${recent}
Candidate: ${data.answer}

Interviewer turn requirements:
- acknowledgement: one concise sentence responding specifically and naturally to the candidate's answer. It may acknowledge, clarify, revisit, or neutrally accept the answer. Do not always compliment.
- transition: one concise sentence that connects to a deeper follow-up or professionally moves to another planned topic.
- question: one clear adaptive question. If the answer was strong, go deeper; if incomplete, clarify a relevant gap; otherwise pivot according to the interview plan.
- Keep all three candidate-facing fields professional. Do not include field labels, scores, evaluation language, or internal rationale in their text.
- Vary wording by checking the recent transcript. Avoid formulaic repetition such as starting every turn with "That's interesting" or "Good".
- Orchestrate by time, without using a fixed question count:
  - beginning: establish background and resume context before narrowing technically.
  - middle: broaden into projects and the selected Technical, Resume, and Behavioral focus areas in proportion to the candidate's configuration.
  - near-end (roughly five minutes remaining): naturally signal that the interview is nearing its end and prioritize a couple of high-value remaining areas.
  - final-minute: make this the final focused question and say so naturally in the transition.
- If several consecutive turns have stayed on one topic, move naturally to an uncovered area unless a critical clarification is still needed.
- Treat answer length as a supporting signal rather than a score: answers under roughly 40 words often need a useful follow-up, while answers over roughly 120 words that already cover the concept should usually lead to a new area so the interview retains breadth.
- Never end because of a question count. Select the best next question for the remaining time and let the application close the interview when time expires.

Return JSON: {
  "evaluation": {
    "technicalAccuracy": number(0-10), "clarity": number(0-10), "relevance": number(0-10),
    "problemSolving": number(0-10), "communication": number(0-10), "overallScore": number(0-10),
    "strengths": string[], "weaknesses": string[], "missingConcepts": string[],
    "idealAnswer": string, "recommendedFollowUp": string
  },
  "next": {
    "acknowledgement": string,
    "transition": string,
    "question": string,
    "topic": string,
    "difficulty": number(1-5)
  }
}`,
      schema: combinedSchema,
      fallback: {
        evaluation: {
          technicalAccuracy: 5,
          clarity: 5,
          relevance: 5,
          problemSolving: 5,
          communication: 5,
          overallScore: 5,
          strengths: [],
          weaknesses: [],
          missingConcepts: [],
          idealAnswer: "",
          recommendedFollowUp: "",
        },
        next: {
          acknowledgement: "Thank you for explaining your approach.",
          transition: "Let's explore that a little further.",
          question: "Can you elaborate further?",
          topic: lastAi.topic ?? "general",
          difficulty: ctx.currentDifficulty ?? 2,
        },
      },
    });

    // Persist evaluation
    const e = combined.evaluation;
    const { error: evaluationError } = await db.from("evaluations").insert({
      interview_message_id: userMsg.id,
      interview_id: data.interviewId,
      technical_accuracy: e.technicalAccuracy,
      clarity: e.clarity,
      relevance: e.relevance,
      problem_solving: e.problemSolving,
      communication: e.communication,
      overall_score: e.overallScore,
      strengths: asJson(e.strengths ?? []),
      weaknesses: asJson(e.weaknesses ?? []),
      missing_concepts: asJson(e.missingConcepts ?? []),
      ideal_answer: e.idealAnswer ?? "",
      recommended_follow_up: e.recommendedFollowUp ?? "",
    });
    if (evaluationError) throw new Error(`Failed to save evaluation: ${evaluationError.message}`);

    // Update interview context + insert next AI question
    const topicScores = { ...(ctx.topicScores ?? {}) };
    const t = lastAi.topic ?? "general";
    topicScores[t] =
      topicScores[t] != null ? (topicScores[t] + e.overallScore) / 2 : e.overallScore;
    const topicsCovered = Array.from(new Set([...(ctx.topicsCovered ?? []), combined.next.topic]));

    const { error: contextError } = await db
      .from("interviews")
      .update({
        context: asJson({
          ...ctx,
          currentDifficulty: combined.next.difficulty,
          topicsCovered,
          topicScores,
          lastRemainingSeconds: remainingSeconds,
          timePhase,
        }),
      })
      .eq("id", data.interviewId)
      .eq("user_id", userId)
      .eq("status", "active");
    if (contextError) throw new Error(`Failed to update interview: ${contextError.message}`);

    const interviewerTurn = [
      combined.next.acknowledgement,
      combined.next.transition,
      combined.next.question,
    ]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join("\n\n");

    const { error: nextMessageError } = await db.from("interview_messages").insert({
      interview_id: data.interviewId,
      role: "ai",
      content: interviewerTurn || "Could you elaborate further?",
      topic: combined.next.topic,
      difficulty: combined.next.difficulty,
      order_index: nextIdx + 1,
    });
    if (nextMessageError)
      throw new Error(`Failed to save next question: ${nextMessageError.message}`);

    return {
      nextQuestion: combined.next.question,
      interviewerTurn: {
        acknowledgement: combined.next.acknowledgement,
        transition: combined.next.transition,
        question: combined.next.question,
      },
    };
  });

// -------- 5. End interview + final report ---------------------------------
export const endInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { interviewId: string }) =>
    z.object({ interviewId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const db = await getTrustedDb();

    const { data: interview } = await db
      .from("interviews")
      .select("id, user_id, role, experience_level")
      .eq("id", data.interviewId)
      .single();
    if (!interview || interview.user_id !== userId) throw new Error("Not found");

    const { data: msgs } = await db
      .from("interview_messages")
      .select("id, role, content, topic, order_index")
      .eq("interview_id", data.interviewId)
      .order("order_index", { ascending: true });
    const { data: evals } = await db
      .from("evaluations")
      .select("*")
      .eq("interview_id", data.interviewId);

    const evalsList = evals ?? [];
    const avg = (k: keyof (typeof evalsList)[number]) => {
      if (!evalsList.length) return 0;
      const sum = evalsList.reduce((a, e) => a + (Number(e[k] ?? 0) || 0), 0);
      return Math.round((sum / evalsList.length) * 10) / 10;
    };
    const dimensions = {
      technicalAccuracy: avg("technical_accuracy"),
      clarity: avg("clarity"),
      relevance: avg("relevance"),
      problemSolving: avg("problem_solving"),
      communication: avg("communication"),
    };
    const overall =
      Math.round(
        ((dimensions.technicalAccuracy +
          dimensions.clarity +
          dimensions.relevance +
          dimensions.problemSolving +
          dimensions.communication) /
          5) *
          10,
      ) / 10;
    const readiness = Math.round(overall * 10);

    const strengths = Array.from(
      new Set(evalsList.flatMap((e) => (e.strengths as string[]) ?? [])),
    ).slice(0, 8);
    const weaknesses = Array.from(
      new Set(evalsList.flatMap((e) => (e.weaknesses as string[]) ?? [])),
    ).slice(0, 8);
    const fillerWords = analyzeFillerWords(
      (msgs ?? []).filter((message) => message.role === "user").map((message) => message.content),
    );

    const report = {
      dimensions,
      overall,
      readiness,
      strengths,
      weaknesses,
      fillerWords,
      messageCount: msgs?.length ?? 0,
    };

    const { error: updErr } = await db
      .from("interviews")
      .update({
        status: "completed",
        overall_score: overall,
        readiness_score: readiness,
        final_report: asJson(report),
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.interviewId)
      .eq("user_id", userId);
    if (updErr) throw new Error(`Failed to save report: ${updErr.message}`);

    // Update profile readiness (rolling avg) — non-fatal
    try {
      const { data: past } = await db
        .from("interviews")
        .select("readiness_score")
        .eq("user_id", userId)
        .eq("status", "completed");
      const avgReadiness =
        past && past.length
          ? Math.round(past.reduce((a, x) => a + Number(x.readiness_score ?? 0), 0) / past.length)
          : readiness;
      await db.from("profiles").update({ readiness_score: avgReadiness }).eq("id", userId);
    } catch (e) {
      console.warn("[endInterview] profile readiness update failed", e);
    }

    return { report };
  });

// -------- 6. Learning Roadmap ---------------------------------------------
// Deterministic pipeline:
//   1. Pull interview + evaluations + candidate profile from DB (source of truth).
//   2. Aggregate weaknesses, missing concepts, and the 2 weakest dimensions.
//   3. Ask the AI ONCE to turn those *concrete* signals into an actionable plan.
//   4. Persist under learning_roadmaps (one row per interview, unique).
// Never regenerated unless the caller explicitly asks (force=true).
type RoadmapStep = {
  title: string;
  why: string;
  actions: string[];
  resources: { label: string; kind: "article" | "video" | "practice" | "book" }[];
  estimatedHours: number;
};
type Roadmap = {
  summary: string;
  targetRole: string;
  priorityFocus: string[]; // ranked list of what to fix first
  weakDimensions: string[]; // dimension names, weakest → less weak
  steps: RoadmapStep[]; // ordered, prioritized
  quickWins: string[]; // things achievable in <1 day
  practiceInterviewPrompts: string[]; // suggestions for next mock
  generatedAt?: string;
};

const roadmapResourceSchema = z.object({
  label: limitedText(500),
  kind: z.enum(["article", "video", "practice", "book"]),
});
const roadmapSchema: z.ZodType<Roadmap> = z.object({
  summary: limitedText(4_000),
  targetRole: limitedText(200),
  priorityFocus: z.array(limitedText(500)).max(8),
  weakDimensions: z.array(limitedText(200)).max(5),
  steps: z
    .array(
      z.object({
        title: limitedText(500),
        why: limitedText(2_000),
        actions: z.array(limitedText(1_000)).max(8),
        resources: z.array(roadmapResourceSchema).max(10),
        estimatedHours: z.number().finite().min(0).max(1_000),
      }),
    )
    .max(8),
  quickWins: z.array(limitedText(1_000)).max(8),
  practiceInterviewPrompts: z.array(limitedText(2_000)).max(8),
  generatedAt: z.string().max(100).optional(),
});

export const getOrGenerateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { interviewId: string }) =>
    z.object({ interviewId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = await getTrustedDb();

    // Ownership + status check
    const { data: interview, error: iErr } = await db
      .from("interviews")
      .select(
        "id, user_id, role, experience_level, interview_types, status, final_report, candidate_profile_id",
      )
      .eq("id", data.interviewId)
      .single();
    if (iErr || !interview) throw new Error("Interview not found");
    if (interview.user_id !== userId) throw new Error("Forbidden");
    if (interview.status !== "completed")
      throw new Error("Interview must be completed before generating a roadmap");

    // Roadmaps are immutable from the candidate API once generated.
    const { data: existing } = await db
      .from("learning_roadmaps")
      .select("content, updated_at")
      .eq("interview_id", data.interviewId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.content) {
      return { roadmap: existing.content as unknown as Roadmap, cached: true };
    }

    await enforceRateLimit(supabase, "roadmap");

    const { data: evals } = await db
      .from("evaluations")
      .select(
        "weaknesses, missing_concepts, strengths, technical_accuracy, clarity, relevance, problem_solving, communication, overall_score",
      )
      .eq("interview_id", data.interviewId);
    const evalsList = evals ?? [];
    if (evalsList.length === 0) throw new Error("No evaluations to build a roadmap from");

    const { data: cp } = interview.candidate_profile_id
      ? await db
          .from("candidate_profiles")
          .select("parsed")
          .eq("id", interview.candidate_profile_id)
          .eq("user_id", userId)
          .maybeSingle()
      : { data: null as { parsed: unknown } | null };

    // Deterministic aggregation
    const dimAvg = (
      k: "technical_accuracy" | "clarity" | "relevance" | "problem_solving" | "communication",
    ) =>
      Math.round((evalsList.reduce((a, e) => a + Number(e[k] ?? 0), 0) / evalsList.length) * 10) /
      10;
    const dims = {
      "Technical Accuracy": dimAvg("technical_accuracy"),
      Clarity: dimAvg("clarity"),
      Relevance: dimAvg("relevance"),
      "Problem Solving": dimAvg("problem_solving"),
      Communication: dimAvg("communication"),
    };
    const weakDimensions = Object.entries(dims)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([k]) => k);

    // Rank weaknesses / missing concepts by frequency (real signal, not LLM guesses)
    const rank = (items: string[]) => {
      const m = new Map<string, number>();
      for (const x of items) if (x?.trim()) m.set(x.trim(), (m.get(x.trim()) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    };
    const rankedWeaknesses = rank(evalsList.flatMap((e) => (e.weaknesses as string[]) ?? [])).slice(
      0,
      12,
    );
    const rankedMissing = rank(
      evalsList.flatMap((e) => (e.missing_concepts as string[]) ?? []),
    ).slice(0, 12);
    const rankedStrengths = rank(evalsList.flatMap((e) => (e.strengths as string[]) ?? [])).slice(
      0,
      6,
    );

    const roadmap = await generateJson<Roadmap>({
      system:
        "You are an expert engineering mentor. Turn concrete interview feedback into a prioritized, actionable study plan. Every step must reference a specific weakness or missing concept — no generic career advice.",
      prompt: `Target role: ${interview.role} (${interview.experience_level ?? "unspecified"})
Interview types: ${(interview.interview_types ?? []).join(", ")}
Candidate profile (skills/projects/experience): ${JSON.stringify(cp?.parsed ?? {}).slice(0, 3000)}

Dimension averages (0–10, lower = weaker):
${Object.entries(dims)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

Weakest dimensions (priority order): ${weakDimensions.join(", ")}

Recurring weaknesses (most frequent first):
${rankedWeaknesses.map((w, i) => `${i + 1}. ${w}`).join("\n") || "(none)"}

Recurring missing concepts (most frequent first):
${rankedMissing.map((w, i) => `${i + 1}. ${w}`).join("\n") || "(none)"}

Existing strengths (do not include as areas to improve):
${rankedStrengths.join(", ") || "(none yet)"}

Return JSON with this shape:
{
  "summary": string (2-3 sentences, honest, grounded in the data above),
  "targetRole": "${interview.role}",
  "priorityFocus": string[]   // 3-5 items, ranked by importance for this role
  "weakDimensions": ${JSON.stringify(weakDimensions)},
  "steps": [
    {
      "title": string,        // specific — e.g. "Master B-tree indexing" not "improve databases"
      "why": string,          // reference the weakness/missing concept it addresses
      "actions": string[],    // 3-5 concrete actions, doable this week
      "resources": [{ "label": string, "kind": "article"|"video"|"practice"|"book" }],
      "estimatedHours": number
    }
  ],   // 4-6 ordered steps, hardest gaps first
  "quickWins": string[],      // 2-4 items achievable in under a day
  "practiceInterviewPrompts": string[]  // 3-5 specific mock-question prompts to try in the next session
}`,
      schema: roadmapSchema,
      fallback: {
        summary: `Focus on ${weakDimensions.join(", ")} for your ${interview.role} interviews.`,
        targetRole: interview.role,
        priorityFocus: rankedWeaknesses.slice(0, 4),
        weakDimensions,
        steps: rankedWeaknesses.slice(0, 4).map((w) => ({
          title: `Address: ${w}`,
          why: "Recurring weakness identified in this interview.",
          actions: [
            "Study the underlying concept.",
            "Solve 3 practice problems.",
            "Re-answer the related question aloud.",
          ],
          resources: [],
          estimatedHours: 3,
        })),
        quickWins: rankedMissing.slice(0, 3),
        practiceInterviewPrompts: [
          `Re-run ${interview.role} mock focused on ${weakDimensions[0] ?? "core skills"}.`,
        ],
        generatedAt: new Date().toISOString(),
      },
      timeoutMs: 60_000,
    });

    roadmap.generatedAt = new Date().toISOString();
    roadmap.weakDimensions = weakDimensions;
    roadmap.targetRole = interview.role;

    // Upsert (unique on interview_id)
    const { error: upErr } = await db
      .from("learning_roadmaps")
      .upsert(
        { user_id: userId, interview_id: data.interviewId, content: asJson(roadmap) },
        { onConflict: "interview_id" },
      );
    if (upErr) throw new Error(`Failed to save roadmap: ${upErr.message}`);

    return { roadmap, cached: false };
  });
