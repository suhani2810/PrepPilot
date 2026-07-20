import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableGateway, DEFAULT_MODEL } from "./ai-gateway.server";
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
}): Promise<T> {
  const gateway = createLovableGateway();
  const model = gateway(DEFAULT_MODEL);
  try {
    const { text } = await generateText({
      model,
      system: opts.system + "\nReturn ONLY valid JSON. No prose, no markdown.",
      prompt: opts.prompt,
    });
    const parsed = safeJsonParse<T>(text);
    return parsed ?? opts.fallback;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      const parsed = safeJsonParse<T>(err.text ?? "");
      if (parsed) return parsed;
    }
    throw err;
  }
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

    await supabase.from("interviews").update({
      status: "completed", overall_score: overall, readiness_score: readiness,
      final_report: asJson(report), completed_at: new Date().toISOString(),
    }).eq("id", data.interviewId);

    // Update profile readiness (rolling avg)
    const { data: past } = await supabase.from("interviews")
      .select("readiness_score").eq("user_id", userId).eq("status", "completed");
    const avgReadiness = past && past.length
      ? Math.round(past.reduce((a, x) => a + Number(x.readiness_score ?? 0), 0) / past.length)
      : readiness;
    await supabase.from("profiles").update({ readiness_score: avgReadiness }).eq("id", userId);

    return { report };
  });
