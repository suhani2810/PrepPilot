import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const SOURCE = "C:/Users/KIIT/Desktop/PrepPilot/.codex-temp/phantom-deck-v2/template-starter.pptx";
const OUTPUT = "C:/Users/KIIT/Desktop/PrepPilot/PrepPilot_Team_Phantom_Features.pptx";
const RENDER = "C:/Users/KIIT/Desktop/PrepPilot/.codex-temp/phantom-deck-v2/final-render";

const edits = {
  "sh/2x836dk3": "GEN AI · PROBLEM STATEMENT 2",
  "sh/3yh4zi1o": "PrepPilot",
  "sh/c3alcn2l": "From resume to ready.",
  "sh/d4jm5sjq": "Resume-aware · Voice/Text · Adaptive · Measurable",
  "sh/r2143210": "TEAM",
  "sh/s76l0321": "PHANTOM",
  "sh/t8fmt8jm": "Team Leader",
  "sh/14nal83m": "Suhani Mahajan",
  "sh/03u9s3m1": "Team Member",
  "sh/z2lsjylg": "Divyam Madan",

  "sh/jaxwj6hk": "PREPPILOT · TEAM PHANTOM",
  "sh/1wjap0b6": "Setup makes every interview candidate-specific",
  "sh/0vatgvul": "02",
  "sh/ny1srqtc": "PrepPilot combines resume intelligence with a required, fully configurable interview setup.",
  "sh/ozutkvuh": "01",
  "sh/bmlsvat8": "Resume intelligence",
  "sh/alcbm5cn": "PDF upload → private storage → editable profile of skills, projects, education and experience.",
  "sh/w7md8ry9": "02",
  "sh/h8vehwzu": "Interview setup",
  "sh/u54v6hg3": "Role, experience level, interview type, 5–180 minute duration, job description and review.",
  "sh/v6dwfmho": "03",
  "sh/4b6dcby5": "Mode selection",
  "sh/5cfelgzq": "Voice or Text is required, stored in session context and locked after the interview launches.",
  "sh/i94va1gf": "That configuration becomes context for every adaptive question.",

  "sh/nyt0nq1g": "PREPPILOT · TEAM PHANTOM",
  "sh/p0nypor6": "Voice and Text use one adaptive interview engine",
  "sh/ozexwjal": "03",
  "sh/fulwjet4": "Two modes, one AI engine",
  "sh/etcfq9sj": "A natural interview from introduction to closing.",
  "sh/1w3eloru": "Voice speaks the introduction with TTS; Text waits for Begin Interview. The timer starts only after the introduction.",
  "sh/65sfmps7": "VOICE MODE",
  "sh/w321kvix": "TTS intro · mic · Groq STT",
  "sh/a1kjil0r": "TEXT MODE",
  "sh/v2tkrq1c": "Intro · Begin Interview · typed answers",
  "sh/90bipgj6": "SESSION RULE",
  "sh/mxkjel0v": "Mode locked · countdown · anti-cheat",

  "sh/wr2pcrah": "PREPPILOT · TEAM PHANTOM",
  "sh/va9czeh0": "One session moves from profile to personalised roadmap",
  "sh/u90vq90f": "04",
  "sh/t8rux4za": "The interview lifecycle is controlled, conversational and measurable.",
  "sh/utcn6d03": "1",
  "sh/ve54ziho": "Profile",
  "sh/wfe58ni9": "Resume PDF becomes an editable profile of skills, projects and experience.",
  "sh/mpcn2d07": "2",
  "sh/7ql4vihs": "Configure",
  "sh/8ru54nid": "Role, level, type, duration, JD and mode are reviewed before launch.",
  "sh/yls3yt0b": "3",
  "sh/zml4ryhg": "Introduce",
  "sh/nqhkzux8": "Greeting explains role, focus and follow-ups; then the timer begins.",
  "sh/psz214fe": "4",
  "sh/orq18zyt": "Adapt",
  "sh/bu1k3exk": "Acknowledgement + transition + question responds to every answer.",
  "sh/xwj25ofq": "5",
  "sh/cva1cjy5": "Improve",
  "sh/ryx0rax0": "Five scores, readiness, per-question feedback and a learning roadmap.",
  "sh/qxojy5gv": "No fixed question count: the session closes naturally when time expires.",

  "sh/u90r6pcb": "PREPPILOT · TEAM PHANTOM",
  "sh/crmtczax": "Context and API keys stay server-side",
  "sh/dsvul4bi": "05",
  "sh/yt4be9sn": "TanStack Start server functions connect the interview UI, AI providers and Supabase data layer.",
  "sh/fitcbut4": "CLIENT UI",
  "sh/fid8ru90": "React · TanStack Start\nVoice recorder · TTS",
  "sh/14vqt4r6": "SERVER FUNCTIONS",
  "sh/gjmp0zal": "create · begin · submit · end\nCSRF-protected RPC",
  "sh/6dk7upsj": "AI PROVIDERS",
  "sh/tgbqp4ru": "Groq LLM + Whisper STT\nOpenRouter fallback",
  "sh/ja9oja9s": "SUPABASE",
  "sh/i907q5s7": "Auth · Postgres · private resumes\nRLS per user",
  "sh/ml0725cz": "Mode stored in interview context",
  "sh/7m98vadk": "Evaluations persisted per answer",
  "sh/87i94fu5": "Reports + roadmaps persisted",
  "sh/98rqxkvq": "Email confirmation, auth-gated routes, private storage and server-only secrets protect candidate data.",

  "sh/obml87ut": "PREPPILOT · TEAM PHANTOM",
  "sh/6xoz214n": "Every answer changes questions and feedback",
  "sh/7yxgb6l8": "06",
  "sh/i9ofyh4b": "01",
  "sh/jaxg7mlw": "Conversational turn",
  "sh/4rqhcvm1": "AI returns acknowledgement + transition + nextQuestion while avoiding repetition, fake praise and score disclosure.",
  "sh/psjylg36": "02",
  "sh/d4bm98b6": "Time-aware orchestration",
  "sh/c32l03ul": "Remaining time and answer depth control follow-ups, topic balance and final-question transitions.",
  "sh/rit47it0": "03",
  "sh/qhk3ydcf": "Five-dimension evaluation",
  "sh/pgbm58bu": "Technical Accuracy, Clarity, Relevance, Problem Solving and Communication score every answer.",
  "sh/4f2lw3u9": "04",
  "sh/3et43yto": "Report → roadmap",
  "sh/2d03utcj": "Readiness gauge, radar, per-question review, strengths, gaps, priority focus, quick wins and practice prompts.",
  "sh/9cfmhsbe": "Readiness = mean answer score × 10; dashboard and history show real scored sessions only.",

  "sh/xw3up0ji": "TEAM PHANTOM · PREPPILOT",
  "sh/cvutwv2x": "Adaptive interviews.\nActionable improvement.",
  "sh/nq1cjq1g": "Resume-aware · Time-aware · Measurable",
  "sh/psjul0j6": "Suhani Mahajan · Team Leader",
  "sh/oratsv21": "Divyam Madan · Team Member",
  "sh/fm1sf614": "GEN AI · PROBLEM STATEMENT 2",
  "sh/e1sbmlkj": "Questions?",
};

const notes = [
  "Introduce Team Phantom and PrepPilot. State that the selected track is Gen AI and Problem Statement 2 is an AI mock interview platform. Preview the product’s differentiators: resume-aware setup, locked Voice/Text modes, adaptive conversations and measurable improvement.",
  "Show that PrepPilot begins before the interview room. A PDF resume is stored privately and converted into an editable candidate profile. The candidate then configures role, experience level, interview type, any duration from 5 to 180 minutes, job description and a required interview mode. The selected mode is persisted and cannot be changed mid-interview.",
  "Explain the two implemented modes. Voice uses the existing browser recorder, Groq transcription and text-to-speech. Text displays the introduction and waits for Begin Interview. In both modes the AI gives a real introduction, the timer begins afterward, and the session ends with a closing message before report generation. Tab and fullscreen safeguards protect session integrity.",
  "Walk through the actual session lifecycle. Resume intelligence and setup form the context. The interviewer introduces the session, then every response generates an acknowledgement, transition and adaptive question. There is no fixed question count; the countdown controls the session, and the completed interview produces five scores, readiness, detailed feedback and a roadmap.",
  "Describe the implementation. The UI is React on TanStack Start. Typed server functions create, begin, submit and end interviews, protected by CSRF middleware. Groq handles the primary LLM and Whisper transcription, with OpenRouter as a text-generation fallback. Supabase provides authentication, Postgres and private resume storage with row-level security. Mode is stored inside the interview context, while evaluations, reports and roadmaps are persisted separately.",
  "Explain how the adaptive loop works. The model receives the previous answer, resume, interview type, history and remaining seconds. It changes behavior at the beginning, middle, final five minutes and final minute. Short answers invite deeper follow-ups; detailed answers move the interview onward. Each answer is scored on Technical Accuracy, Clarity, Relevance, Problem Solving and Communication. The report then drives priority areas, quick wins, ordered study steps and practice prompts.",
  "Close with the complete product loop: PrepPilot understands the candidate, runs a realistic adaptive interview, measures each answer and converts weaknesses into a next-step plan. Invite the judges to view the live demo or ask questions.",
];

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(RENDER, { recursive: true });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(SOURCE));

  const textCounts = [10, 14, 12, 20, 16, 16, 7];
  const desiredValues = Object.values(edits);
  const desiredBySlide = [];
  let cursor = 0;
  for (const count of textCounts) {
    desiredBySlide.push(desiredValues.slice(cursor, cursor + count));
    cursor += count;
  }

  const liveInspect = await presentation.inspect({
    kind: "textbox",
    include: "id,slide",
    maxChars: 30000,
  });
  const liveTextboxes = liveInspect.ndjson
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((record) => record.kind === "textbox");

  for (let slideNumber = 1; slideNumber <= textCounts.length; slideNumber += 1) {
    const records = liveTextboxes.filter((record) => record.slide === slideNumber);
    const values = desiredBySlide[slideNumber - 1];
    if (records.length !== values.length) {
      throw new Error(`Slide ${slideNumber}: expected ${values.length} textboxes, found ${records.length}.`);
    }
    records.forEach((record, index) => {
      presentation.resolve(record.id).text = values[index];
    });
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    slide.speakerNotes.textFrame.setText(`${notes[index]}\n\n[Sources]\n- PrepPilot repository: current routes, server functions, transcription handler and Supabase migrations`);
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
