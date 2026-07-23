import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { getAIModels } from "./ai.server";
import type { Json } from "@/integrations/supabase/types";

const asJson = (v: unknown) => v as unknown as Json;


// -------- helpers ------------------------------------------------
function stripJsonFence(s: string): string {
  return s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}
function safeJsonParse<T>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch {}
  const cleaned = stripJsonFence(text);
  try { return JSON.parse(cleaned) as T; } catch {}
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)) as T; } catch {}
  }
  return null;
}

async function generateJson<T>(opts: {
  system: string;
  prompt: string;
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
      const parsed = safeJsonParse<T>(text);
      return parsed ?? opts.fallback;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        const parsed = safeJsonParse<T>(err.text ?? "");
        if (parsed) return parsed;
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

// -------- 1. Parse resume --------------------------------------------------
export const parseResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { resumePath: string }) => z.object({ resumePath: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: file, error: dlErr } = await supabase.storage.from("resumes").download(data.resumePath);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download resume");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { extractPdfText } = await import("./pdf.server");
    const resumeText = (await extractPdfText(bytes)).slice(0, 60_000);

    const parsed = await generateJson<Record<string, unknown>>({
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

    const { data: existing } = await supabase
      .from("candidate_profiles").select("id").eq("user_id", userId).maybeSingle();

    if (existing) {
      const { error } = await supabase.from("candidate_profiles").update({
        resume_path: data.resumePath, resume_text: resumeText, parsed: parsedJson,
      }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: inserted, error } = await supabase.from("candidate_profiles").insert({
      user_id: userId, resume_path: data.resumePath, resume_text: resumeText, parsed: parsedJson,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

// -------- 2. Update parsed profile (user edits) ----------------------------
export const updateCandidateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; parsed: unknown }) =>
    z.object({ id: z.string().uuid(), parsed: z.any() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("candidate_profiles").update({ parsed: asJson(data.parsed) }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- 3. Start interview: build plan + first question ------------------
export const startInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    role: string; experienceLevel: string; interviewTypes: string[];
    jobDescription?: string; durationMinutes: number;
  }) => z.object({
    role: z.string().min(1),
    experienceLevel: z.string().min(1),
    interviewTypes: z.array(z.string()).min(1),
    jobDescription: z.string().optional(),
    durationMinutes: z.number().int().min(5).max(180),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cp } = await supabase.from("candidate_profiles")
      .select("id, parsed").eq("user_id", userId).maybeSingle();

    const candidateSummary = cp?.parsed ?? {};
    const plan = await generateJson<{ topics: { name: string; weight: number }[]; summary: string }>({
      system: "You are an interview planner. Create an interview plan tailored to a candidate.",
      prompt: `Candidate profile: ${JSON.stringify(candidateSummary).slice(0, 8000)}
Target role: ${data.role}
Experience level: ${data.experienceLevel}
Interview types: ${data.interviewTypes.join(", ")}
Job description: ${data.jobDescription ?? "(none)"}
Duration: ${data.durationMinutes} minutes.

Return JSON: { "summary": string, "topics": [{ "name": string, "weight": number }] }
5-8 topics. Weights are numbers 1-5 based on importance.`,
      fallback: { topics: [{ name: data.role, weight: 3 }], summary: data.role },
    });

    const first = await generateJson<{ question: string; topic: string; difficulty: number }>({
      system: "You are an expert interviewer. Ask a clear, focused opening interview question tailored to the candidate.",
      prompt: `Candidate: ${JSON.stringify(candidateSummary).slice(0, 4000)}
Role: ${data.role} (${data.experienceLevel}). Types: ${data.interviewTypes.join(", ")}.
Plan topics: ${plan.topics.map((t) => t.name).join(", ")}.

Ask an opening question. Return JSON: { "question": string, "topic": string, "difficulty": number(1-5) }`,
      fallback: { question: `Tell me about yourself and your experience relevant to a ${data.role} role.`, topic: "intro", difficulty: 2 },
    });

    const { data: interview, error: iErr } = await supabase.from("interviews").insert({
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
      }),
      status: "active",
      started_at: new Date().toISOString(),
    }).select("id").single();
    if (iErr) throw new Error(iErr.message);

    const { error: mErr } = await supabase.from("interview_messages").insert({
      interview_id: interview.id, role: "ai", content: first.question,
      topic: first.topic, difficulty: first.difficulty, order_index: 0,
    });
    if (mErr) throw new Error(mErr.message);

    return { interviewId: interview.id };
  });

// -------- 4. Submit answer → evaluate + next question ---------------------
type EvalResult = {
  technicalAccuracy: number; clarity: number; relevance: number;
  problemSolving: number; communication: number; overallScore: number;
  strengths: string[]; weaknesses: string[]; missingConcepts: string[];
  idealAnswer: string; recommendedFollowUp: string;
};

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { interviewId: string; answer: string }) =>
    z.object({ interviewId: z.string().uuid(), answer: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: interview, error: iErr } = await supabase.from("interviews")
      .select("id, user_id, role, experience_level, interview_types, plan, context, candidate_profile_id")
      .eq("id", data.interviewId).single();
    if (iErr || !interview) throw new Error(iErr?.message ?? "Interview not found");
    if (interview.user_id !== userId) throw new Error("Forbidden");

    const { data: cp } = interview.candidate_profile_id
      ? await supabase.from("candidate_profiles").select("parsed").eq("id", interview.candidate_profile_id).maybeSingle()
      : { data: null as { parsed: unknown } | null };

    const { data: msgs } = await supabase.from("interview_messages")
      .select("id, role, content, topic, difficulty, order_index")
      .eq("interview_id", data.interviewId).order("order_index", { ascending: true });
    const messages = msgs ?? [];
    const lastAi = [...messages].reverse().find((m) => m.role === "ai");
    if (!lastAi) throw new Error("No pending question");

    const nextIdx = messages.length;

    // Store the user's answer
    const { data: userMsg, error: umErr } = await supabase.from("interview_messages").insert({
      interview_id: data.interviewId, role: "user", content: data.answer,
      topic: lastAi.topic, difficulty: lastAi.difficulty, order_index: nextIdx,
    }).select("id").single();
    if (umErr) throw new Error(umErr.message);

    const recent = messages.slice(-6).map((m) => `${m.role === "ai" ? "Interviewer" : "Candidate"}: ${m.content}`).join("\n");
    const ctx = (interview.context ?? {}) as { currentDifficulty?: number; topicsCovered?: string[]; topicScores?: Record<string, number> };

    // Single call: evaluate AND next question
    type Combined = { evaluation: EvalResult; next: { question: string; topic: string; difficulty: number; rationale: string } };
    const combined = await generateJson<Combined>({
      system: "You are an expert technical interviewer AND evaluator. Evaluate the candidate's last answer, then generate the next adaptive question. If the answer was strong go deeper on the topic. If it was weak, clarify fundamentals or pivot. Reference specifics from the candidate's resume when relevant.",
      prompt: `Candidate profile: ${JSON.stringify(cp?.parsed ?? {}).slice(0, 4000)}
Role: ${interview.role} (${interview.experience_level}). Types: ${(interview.interview_types ?? []).join(", ")}.
Plan topics: ${JSON.stringify(interview.plan)}
Current difficulty: ${ctx.currentDifficulty ?? 2}
Topics covered: ${(ctx.topicsCovered ?? []).join(", ")}
Recent transcript:
${recent}
Candidate: ${data.answer}

Return JSON: {
  "evaluation": {
    "technicalAccuracy": number(0-10), "clarity": number(0-10), "relevance": number(0-10),
    "problemSolving": number(0-10), "communication": number(0-10), "overallScore": number(0-10),
    "strengths": string[], "weaknesses": string[], "missingConcepts": string[],
    "idealAnswer": string, "recommendedFollowUp": string
  },
  "next": { "question": string, "topic": string, "difficulty": number(1-5), "rationale": string }
}`,
      fallback: {
        evaluation: {
          technicalAccuracy: 5, clarity: 5, relevance: 5, problemSolving: 5, communication: 5,
          overallScore: 5, strengths: [], weaknesses: [], missingConcepts: [],
          idealAnswer: "", recommendedFollowUp: "",
        },
        next: { question: "Can you elaborate further?", topic: lastAi.topic ?? "general", difficulty: ctx.currentDifficulty ?? 2, rationale: "" },
      },
    });

    // Persist evaluation
    const e = combined.evaluation;
    await supabase.from("evaluations").insert({
      interview_message_id: userMsg.id, interview_id: data.interviewId,
      technical_accuracy: e.technicalAccuracy, clarity: e.clarity, relevance: e.relevance,
      problem_solving: e.problemSolving, communication: e.communication, overall_score: e.overallScore,
      strengths: asJson(e.strengths ?? []), weaknesses: asJson(e.weaknesses ?? []),
      missing_concepts: asJson(e.missingConcepts ?? []),
      ideal_answer: e.idealAnswer ?? "", recommended_follow_up: e.recommendedFollowUp ?? "",
    });

    // Update interview context + insert next AI question
    const topicScores = { ...(ctx.topicScores ?? {}) };
    const t = lastAi.topic ?? "general";
    topicScores[t] = topicScores[t] != null ? (topicScores[t] + e.overallScore) / 2 : e.overallScore;
    const topicsCovered = Array.from(new Set([...(ctx.topicsCovered ?? []), combined.next.topic]));

    await supabase.from("interviews").update({
      context: asJson({ currentDifficulty: combined.next.difficulty, topicsCovered, topicScores }),
    }).eq("id", data.interviewId);

    await supabase.from("interview_messages").insert({
      interview_id: data.interviewId, role: "ai", content: combined.next.question,
      topic: combined.next.topic, difficulty: combined.next.difficulty, order_index: nextIdx + 1,
    });

    return { evaluation: e, nextQuestion: combined.next.question };
  });

// -------- 5. End interview + final report ---------------------------------
export const endInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { interviewId: string }) =>
    z.object({ interviewId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: interview } = await supabase.from("interviews")
      .select("id, user_id, role, experience_level").eq("id", data.interviewId).single();
    if (!interview || interview.user_id !== userId) throw new Error("Not found");

    const { data: msgs } = await supabase.from("interview_messages")
      .select("id, role, content, topic, order_index")
      .eq("interview_id", data.interviewId).order("order_index", { ascending: true });
    const { data: evals } = await supabase.from("evaluations")
      .select("*").eq("interview_id", data.interviewId);

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
    const overall = Math.round(
      ((dimensions.technicalAccuracy + dimensions.clarity + dimensions.relevance +
        dimensions.problemSolving + dimensions.communication) / 5) * 10,
    ) / 10;
    const readiness = Math.round(overall * 10);

    const strengths = Array.from(new Set(evalsList.flatMap((e) => (e.strengths as string[]) ?? []))).slice(0, 8);
    const weaknesses = Array.from(new Set(evalsList.flatMap((e) => (e.weaknesses as string[]) ?? []))).slice(0, 8);

    const report = { dimensions, overall, readiness, strengths, weaknesses, messageCount: msgs?.length ?? 0 };

    const { error: updErr } = await supabase.from("interviews").update({
      status: "completed", overall_score: overall, readiness_score: readiness,
      final_report: asJson(report), completed_at: new Date().toISOString(),
    }).eq("id", data.interviewId);
    if (updErr) throw new Error(`Failed to save report: ${updErr.message}`);

    // Update profile readiness (rolling avg) — non-fatal
    try {
      const { data: past } = await supabase.from("interviews")
        .select("readiness_score").eq("user_id", userId).eq("status", "completed");
      const avgReadiness = past && past.length
        ? Math.round(past.reduce((a, x) => a + Number(x.readiness_score ?? 0), 0) / past.length)
        : readiness;
      await supabase.from("profiles").update({ readiness_score: avgReadiness }).eq("id", userId);
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
  priorityFocus: string[];        // ranked list of what to fix first
  weakDimensions: string[];       // dimension names, weakest → less weak
  steps: RoadmapStep[];           // ordered, prioritized
  quickWins: string[];            // things achievable in <1 day
  practiceInterviewPrompts: string[]; // suggestions for next mock
  generatedAt: string;
};

export const getOrGenerateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { interviewId: string; force?: boolean }) =>
    z.object({ interviewId: z.string().uuid(), force: z.boolean().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ownership + status check
    const { data: interview, error: iErr } = await supabase.from("interviews")
      .select("id, user_id, role, experience_level, interview_types, status, final_report, candidate_profile_id")
      .eq("id", data.interviewId).single();
    if (iErr || !interview) throw new Error("Interview not found");
    if (interview.user_id !== userId) throw new Error("Forbidden");
    if (interview.status !== "completed") throw new Error("Interview must be completed before generating a roadmap");

    // Return cached if present, unless force
    if (!data.force) {
      const { data: existing } = await supabase.from("learning_roadmaps")
        .select("content, updated_at").eq("interview_id", data.interviewId).maybeSingle();
      if (existing?.content) {
        return { roadmap: existing.content as unknown as Roadmap, cached: true };
      }
    }

    const { data: evals } = await supabase.from("evaluations")
      .select("weaknesses, missing_concepts, strengths, technical_accuracy, clarity, relevance, problem_solving, communication, overall_score")
      .eq("interview_id", data.interviewId);
    const evalsList = evals ?? [];
    if (evalsList.length === 0) throw new Error("No evaluations to build a roadmap from");

    const { data: cp } = interview.candidate_profile_id
      ? await supabase.from("candidate_profiles").select("parsed").eq("id", interview.candidate_profile_id).maybeSingle()
      : { data: null as { parsed: unknown } | null };

    // Deterministic aggregation
    const dimAvg = (k: "technical_accuracy" | "clarity" | "relevance" | "problem_solving" | "communication") =>
      Math.round((evalsList.reduce((a, e) => a + Number(e[k] ?? 0), 0) / evalsList.length) * 10) / 10;
    const dims = {
      "Technical Accuracy": dimAvg("technical_accuracy"),
      "Clarity": dimAvg("clarity"),
      "Relevance": dimAvg("relevance"),
      "Problem Solving": dimAvg("problem_solving"),
      "Communication": dimAvg("communication"),
    };
    const weakDimensions = Object.entries(dims).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k]) => k);

    // Rank weaknesses / missing concepts by frequency (real signal, not LLM guesses)
    const rank = (items: string[]) => {
      const m = new Map<string, number>();
      for (const x of items) if (x?.trim()) m.set(x.trim(), (m.get(x.trim()) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    };
    const rankedWeaknesses = rank(evalsList.flatMap((e) => (e.weaknesses as string[]) ?? [])).slice(0, 12);
    const rankedMissing = rank(evalsList.flatMap((e) => (e.missing_concepts as string[]) ?? [])).slice(0, 12);
    const rankedStrengths = rank(evalsList.flatMap((e) => (e.strengths as string[]) ?? [])).slice(0, 6);

    const roadmap = await generateJson<Roadmap>({
      system: "You are an expert engineering mentor. Turn concrete interview feedback into a prioritized, actionable study plan. Every step must reference a specific weakness or missing concept — no generic career advice.",
      prompt: `Target role: ${interview.role} (${interview.experience_level ?? "unspecified"})
Interview types: ${(interview.interview_types ?? []).join(", ")}
Candidate profile (skills/projects/experience): ${JSON.stringify(cp?.parsed ?? {}).slice(0, 3000)}

Dimension averages (0–10, lower = weaker):
${Object.entries(dims).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

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
      fallback: {
        summary: `Focus on ${weakDimensions.join(", ")} for your ${interview.role} interviews.`,
        targetRole: interview.role,
        priorityFocus: rankedWeaknesses.slice(0, 4),
        weakDimensions,
        steps: rankedWeaknesses.slice(0, 4).map((w) => ({
          title: `Address: ${w}`,
          why: "Recurring weakness identified in this interview.",
          actions: ["Study the underlying concept.", "Solve 3 practice problems.", "Re-answer the related question aloud."],
          resources: [],
          estimatedHours: 3,
        })),
        quickWins: rankedMissing.slice(0, 3),
        practiceInterviewPrompts: [`Re-run ${interview.role} mock focused on ${weakDimensions[0] ?? "core skills"}.`],
        generatedAt: new Date().toISOString(),
      },
      timeoutMs: 60_000,
    });

    roadmap.generatedAt = new Date().toISOString();
    roadmap.weakDimensions = weakDimensions;
    roadmap.targetRole = interview.role;

    // Upsert (unique on interview_id)
    const { error: upErr } = await supabase.from("learning_roadmaps")
      .upsert({ user_id: userId, interview_id: data.interviewId, content: asJson(roadmap) }, { onConflict: "interview_id" });
    if (upErr) throw new Error(`Failed to save roadmap: ${upErr.message}`);

    return { roadmap, cached: false };
  });
