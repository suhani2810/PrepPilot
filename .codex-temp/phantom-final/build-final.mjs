import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const SOURCE = "C:/Users/KIIT/Desktop/PrepPilot/.codex-temp/phantom-final/template-starter.pptx";
const OUTPUT = "C:/Users/KIIT/Desktop/PrepPilot/PrepPilot_Team_Phantom_Final.pptx";
const RENDER = "C:/Users/KIIT/Desktop/PrepPilot/.codex-temp/phantom-final/final-render";

const textBySlide = [
  [
    "GEN AI · PROBLEM STATEMENT 2",
    "PrepPilot",
    "From Resume to Ready",
    "AI-powered adaptive mock interview platform",
    "TEAM",
    "PHANTOM",
    "Team Leader",
    "Suhani Mahajan",
    "Team Member",
    "Divyam Madan",
  ],
  [
    "PREPPILOT · TEAM PHANTOM",
    "Generic practice misses the real interview",
    "02",
    "Fixed questions ignore the candidate, cannot react to answers and rarely explain what to improve.",
    "01",
    "Resume-blind",
    "Generic questions ignore the candidate’s resume, target role and job description.",
    "02",
    "Static",
    "Fixed sequences do not react to previous answers or the remaining interview time.",
    "03",
    "Shallow feedback",
    "Scores without clear next steps do not create a focused improvement plan.",
    "PrepPilot combines candidate context, adaptive questioning and an actionable roadmap.",
  ],
  [
    "PREPPILOT · TEAM PHANTOM",
    "Personalisation starts before the interview",
    "03",
    "Resume intelligence and complete setup become context for every question.",
    "01",
    "Resume intelligence",
    "PDF → private storage → editable profile of skills, projects, education and experience.",
    "02",
    "Complete setup",
    "Role, level, focus, 5–180 minute duration, job description and final review.",
    "03",
    "Locked mode",
    "Voice or Text is required, stored in the session and locked after launch.",
    "The AI enters the interview already knowing who and what it is interviewing.",
  ],
  [
    "PREPPILOT · TEAM PHANTOM",
    "Voice and Text use the same adaptive engine",
    "04",
    "Two modes, one interview",
    "A natural experience from introduction to closing.",
    "The introduction explains role, duration, focus and adaptive follow-ups. The timer starts only after it finishes.",
    "VOICE MODE",
    "TTS intro · microphone · Groq STT",
    "TEXT MODE",
    "Intro · Begin Interview · typed answers",
    "SHARED SESSION",
    "Mode locked · countdown · anti-cheat · outro",
  ],
  [
    "PREPPILOT · TEAM PHANTOM",
    "Every answer changes the next interviewer turn",
    "05",
    "01",
    "Live context",
    "Previous answer, resume, selected interview type, history and remaining time shape the next turn.",
    "02",
    "Natural response",
    "Acknowledgement + transition + question, without repetition, fake praise or score disclosure.",
    "03",
    "Time stages",
    "Background first; projects in the middle; final questions near the end and in the last minute.",
    "04",
    "Answer depth",
    "Short answers trigger follow-ups; detailed answers move on while balancing technical, resume and behavioural topics.",
    "No fixed question count: remaining time controls the interview.",
  ],
  [
    "PREPPILOT · TEAM PHANTOM",
    "Evaluation becomes a personalised improvement plan",
    "06",
    "01",
    "Five dimensions",
    "Technical Accuracy, Clarity, Relevance, Problem Solving and Communication score every answer.",
    "02",
    "Readiness",
    "Mean of all per-answer overall scores × 10—a deterministic, recomputable percentage.",
    "03",
    "Performance report",
    "Readiness gauge, radar, per-question feedback, strengths, gaps and ideal-answer guidance.",
    "04",
    "Learning roadmap",
    "Priority focus, weak dimensions, quick wins, ordered study steps and next-session practice prompts.",
    "Dashboard and history show completed, scored sessions—not placeholder analytics.",
  ],
  [
    "TEAM PHANTOM · SUHANI MAHAJAN · DIVYAM MADAN",
    "Built securely, designed to improve readiness",
    "07",
    "Server-side GenAI architecture keeps candidate context, data and secrets protected.",
    "APPLICATION",
    "React · TanStack Start\nVoice recorder · TTS",
    "SERVER LAYER",
    "Typed server functions\nCSRF protection",
    "AI LAYER",
    "Groq + Whisper STT\nOpenRouter fallback",
    "DATA LAYER",
    "Supabase Auth · Postgres\nPrivate resumes · RLS",
    "Email verification + auth gates",
    "Server-only API keys",
    "Private user-scoped data",
    "PrepPilot understands the candidate, adapts the interview and turns every weakness into a clear next step.",
  ],
];

const notes = [
  "Introduce Team Phantom and PrepPilot. State that the selected track is Gen AI and the challenge is Problem Statement 2: an AI mock interview platform. Position PrepPilot as an adaptive interview experience that moves a candidate from resume to readiness.",
  "Explain the gap PrepPilot addresses. Generic question banks ignore the resume and target role. Fixed sequences cannot react to earlier answers or remaining time. Scores without next steps do not help candidates improve. PrepPilot combines candidate context, adaptive questioning and a learning roadmap in one flow.",
  "Explain how personalisation begins before the first question. A PDF resume is stored privately and converted into an editable profile of skills, projects, education and experience. The candidate configures target role, experience level, interview focus, a custom 5-to-180-minute duration, job description and a required Voice or Text mode. The mode is persisted and locked after launch.",
  "Describe the two modes. Voice speaks the introduction through TTS, records microphone input and transcribes it with Groq Whisper. Text displays the introduction and waits for Begin Interview. Both modes share the same adaptive engine, start the timer only after the introduction, remain locked for the session, use countdown and integrity safeguards, and close naturally before report generation.",
  "Explain the adaptive interviewer. It receives the previous answer, resume, interview type, interview history and remaining seconds. Every output contains an acknowledgement, transition and next question. The language avoids repetition, fake praise, score disclosure and internal reasoning. The orchestration changes across the beginning, middle, final five minutes and final minute. Short answers invite follow-ups; detailed answers allow broader topic coverage.",
  "Explain the measurable output. Each answer is scored on Technical Accuracy, Clarity, Relevance, Problem Solving and Communication. Readiness is the mean per-answer overall score multiplied by ten. The report shows a readiness gauge, radar, per-question feedback, strengths, gaps and ideal-answer guidance. The roadmap converts weaknesses into priority areas, quick wins, ordered study steps and practice prompts. Dashboard and history use real completed interviews only.",
  "Close with the architecture and security. PrepPilot uses React and TanStack Start, typed server functions protected by CSRF middleware, Groq for primary generation and Whisper transcription, OpenRouter as a text fallback, and Supabase for Auth, Postgres and private resume storage. Email verification, auth-gated routes, row-level security, private user-scoped storage and server-only API keys protect candidate data. Finish by restating that PrepPilot understands, adapts, measures and guides improvement.",
];

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(RENDER, { recursive: true });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(SOURCE));
  const live = await presentation.inspect({ kind: "textbox", include: "id,slide", maxChars: 30000 });
  const records = live.ndjson
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((record) => record.kind === "textbox");

  for (let slideNumber = 1; slideNumber <= textBySlide.length; slideNumber += 1) {
    const slideRecords = records.filter((record) => record.slide === slideNumber);
    const values = textBySlide[slideNumber - 1];
    if (slideRecords.length !== values.length) {
      throw new Error(`Slide ${slideNumber}: expected ${values.length} textboxes, found ${slideRecords.length}.`);
    }
    slideRecords.forEach((record, index) => {
      presentation.resolve(record.id).text = values[index];
    });
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    slide.speakerNotes.textFrame.setText(`${notes[index]}\n\n[Sources]\n- User-approved slide content\n- PrepPilot repository: current routes, server functions, transcription handler and Supabase migrations`);
    slide.speakerNotes.setVisible(true);
    await writeBlob(`${RENDER}/slide-${index + 1}.png`, await presentation.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${RENDER}/slide-${index + 1}.layout.json`, await layout.text());
  }

  const snapshot = await presentation.inspect({
    kind: "slide,textbox,shape,notes,layout",
    include: "id,slide,name,bbox,textPreview,isPlaceholder,placeholders",
    maxChars: 50000,
  });
  await fs.writeFile(`${RENDER}/final-inspect.ndjson`, snapshot.ndjson);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUTPUT);
  console.log(OUTPUT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
