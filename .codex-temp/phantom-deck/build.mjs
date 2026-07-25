import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/Users/KIIT/Desktop/PrepPilot/PrepPilot_Team_Phantom.pptx";
const RENDER_DIR = "C:/Users/KIIT/Desktop/PrepPilot/.codex-temp/phantom-deck/rendered";

const C = {
  navy: "#081521",
  navy2: "#102637",
  ink: "#10212E",
  muted: "#5D7080",
  teal: "#19B8A5",
  cyan: "#68D9D0",
  sky: "#DDF7F4",
  pale: "#F3F8F8",
  white: "#FFFFFF",
  line: "#C9D9DC",
  coral: "#F28C82",
};

const FONT = "Aptos";
const W = 1280;
const H = 720;

function addText(slide, text, position, opts = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    typeface: FONT,
    fontSize: opts.fontSize ?? 22,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    alignment: opts.alignment ?? "left",
    verticalAlignment: opts.verticalAlignment ?? "top",
    autoFit: opts.autoFit ?? "shrinkText",
    wrap: "square",
    ...opts.style,
  };
  return box;
}

function addBox(slide, position, opts = {}) {
  const geometry = opts.geometry ?? "roundRect";
  return slide.shapes.add({
    geometry,
    position,
    fill: opts.fill ?? C.white,
    line: {
      style: "solid",
      fill: opts.lineFill ?? "none",
      width: opts.lineWidth ?? 0,
    },
    ...(geometry === "rect" || geometry === "textbox" || geometry === "roundRect"
      ? { borderRadius: "rounded-xl" }
      : {}),
  });
}

function addLine(slide, left, top, width, height, color = C.line, lineWidth = 2) {
  return slide.shapes.add({
    geometry: "straightConnector1",
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: color, width: lineWidth },
  });
}

function addHeader(slide, title, number, dark = false) {
  addText(slide, "PREPPILOT · TEAM PHANTOM", { left: 56, top: 35, width: 420, height: 30 }, {
    fontSize: 16,
    bold: true,
    color: dark ? C.cyan : C.teal,
  });
  addText(slide, title, { left: 56, top: 76, width: 1120, height: 72 }, {
    fontSize: 48,
    bold: true,
    color: dark ? C.white : C.ink,
  });
  addText(slide, String(number).padStart(2, "0"), { left: 1172, top: 40, width: 52, height: 28 }, {
    fontSize: 16,
    bold: true,
    color: dark ? C.cyan : C.muted,
    alignment: "right",
  });
}

function addNotes(slide, notes) {
  slide.speakerNotes.textFrame.setText(`${notes}\n\n[Sources]\n- PrepPilot project repository: README.md and current implementation`);
  slide.speakerNotes.setVisible(true);
}

function addStepNode(slide, x, n, title, body) {
  addBox(slide, { left: x, top: 272, width: 68, height: 68 }, { fill: C.teal, geometry: "ellipse" });
  addText(slide, String(n), { left: x, top: 287, width: 68, height: 36 }, {
    fontSize: 25,
    bold: true,
    color: C.white,
    alignment: "center",
    verticalAlignment: "middle",
  });
  addText(slide, title, { left: x - 55, top: 370, width: 178, height: 42 }, {
    fontSize: 25,
    bold: true,
    alignment: "center",
  });
  addText(slide, body, { left: x - 55, top: 420, width: 178, height: 100 }, {
    fontSize: 19,
    color: C.muted,
    alignment: "center",
  });
}

async function main() {
  await fs.mkdir(RENDER_DIR, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });

  // 1 — Title
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.navy;
    addBox(slide, { left: 0, top: 0, width: 18, height: H }, { fill: C.teal, geometry: "rect" });
    addText(slide, "GEN AI · PROBLEM STATEMENT 2", { left: 70, top: 58, width: 500, height: 35 }, {
      fontSize: 18,
      bold: true,
      color: C.cyan,
    });
    addText(slide, "PrepPilot", { left: 70, top: 176, width: 720, height: 105 }, {
      fontSize: 82,
      bold: true,
      color: C.white,
    });
    addText(slide, "From resume to ready.", { left: 74, top: 300, width: 650, height: 54 }, {
      fontSize: 32,
      color: C.cyan,
    });
    addText(slide, "An adaptive AI mock interview platform", { left: 74, top: 380, width: 690, height: 48 }, {
      fontSize: 26,
      color: "#C7D5DC",
    });
    addLine(slide, 880, 110, 0, 500, "#274557", 2);
    addText(slide, "TEAM", { left: 930, top: 150, width: 240, height: 30 }, { fontSize: 16, bold: true, color: C.cyan });
    addText(slide, "PHANTOM", { left: 930, top: 190, width: 260, height: 55 }, { fontSize: 38, bold: true, color: C.white });
    addText(slide, "Team Leader", { left: 930, top: 330, width: 240, height: 28 }, { fontSize: 17, color: C.cyan });
    addText(slide, "Suhani Mahajan", { left: 930, top: 365, width: 260, height: 40 }, { fontSize: 26, bold: true, color: C.white });
    addText(slide, "Team Member", { left: 930, top: 450, width: 240, height: 28 }, { fontSize: 17, color: C.cyan });
    addText(slide, "Divyam Madan", { left: 930, top: 485, width: 260, height: 40 }, { fontSize: 26, bold: true, color: C.white });
    addNotes(slide, "Introduce Team Phantom and PrepPilot. State that the selected track is Gen AI and the challenge is to build an AI mock interview platform. Position PrepPilot as a personalised practice environment rather than a fixed question bank.");
  }

  // 2 — Problem
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.pale;
    addHeader(slide, "Interview practice rarely feels like the real thing", 2);
    addText(slide, "Candidates often practise with generic questions, receive little context-aware feedback, and cannot see what to improve next.", { left: 56, top: 172, width: 1080, height: 92 }, {
      fontSize: 30,
      color: C.ink,
    });
    const cols = [56, 448, 840];
    const data = [
      ["01", "Generic", "The same questions ignore the candidate’s resume, target role and job description."],
      ["02", "Static", "A fixed sequence cannot follow up, change difficulty or react to answer depth."],
      ["03", "Unclear", "A score alone does not translate into a focused plan for improvement."],
    ];
    addLine(slide, 424, 330, 0, 255, C.line, 2);
    addLine(slide, 816, 330, 0, 255, C.line, 2);
    data.forEach((d, i) => {
      addText(slide, d[0], { left: cols[i], top: 330, width: 70, height: 34 }, { fontSize: 18, bold: true, color: C.teal });
      addText(slide, d[1], { left: cols[i], top: 385, width: 300, height: 48 }, { fontSize: 32, bold: true });
      addText(slide, d[2], { left: cols[i], top: 455, width: 315, height: 112 }, { fontSize: 21, color: C.muted });
    });
    addText(slide, "The gap: realistic practice must adapt in real time.", { left: 56, top: 622, width: 820, height: 38 }, { fontSize: 25, bold: true, color: C.teal });
    addNotes(slide, "Explain the three problems: generic practice, static questioning and unclear next steps. Emphasise that interviews are conversations, so a useful mock interview must react to the candidate rather than replay a fixed list.");
  }

  // 3 — Solution
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.white;
    addHeader(slide, "PrepPilot turns candidate context into a live interview", 3);
    addText(slide, "One connected experience", { left: 56, top: 190, width: 420, height: 42 }, { fontSize: 26, bold: true, color: C.teal });
    addText(slide, "Upload once. Practise realistically. Improve with direction.", { left: 56, top: 250, width: 500, height: 145 }, { fontSize: 42, bold: true });
    addText(slide, "The AI interviewer uses the resume, selected role, interview focus, history and remaining time to shape every turn.", { left: 56, top: 430, width: 500, height: 120 }, { fontSize: 22, color: C.muted });
    addLine(slide, 650, 220, 0, 360, C.line, 2);
    const items = [
      ["CONTEXT", "Resume + role + job description"],
      ["CONVERSATION", "Adaptive Voice or Text interview"],
      ["IMPROVEMENT", "Report + personalised roadmap"],
    ];
    items.forEach((item, i) => {
      const y = 190 + i * 150;
      addBox(slide, { left: 710, top: y, width: 470, height: 115 }, { fill: i === 1 ? C.navy2 : C.sky });
      addText(slide, item[0], { left: 742, top: y + 20, width: 180, height: 26 }, { fontSize: 16, bold: true, color: i === 1 ? C.cyan : C.teal });
      addText(slide, item[1], { left: 742, top: y + 55, width: 400, height: 40 }, { fontSize: 25, bold: true, color: i === 1 ? C.white : C.ink });
    });
    addNotes(slide, "Present PrepPilot as one connected loop. Candidate context powers the interview; the adaptive conversation captures performance; the report and roadmap convert performance into action.");
  }

  // 4 — Journey
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.pale;
    addHeader(slide, "The candidate journey stays simple from start to insight", 4);
    addText(slide, "Five steps connect preparation, practice and improvement.", { left: 56, top: 150, width: 840, height: 40 }, { fontSize: 24, color: C.muted });
    // Connectors first so they remain behind the nodes.
    addLine(slide, 178, 306, 188, 0, C.line, 5);
    addLine(slide, 405, 306, 188, 0, C.line, 5);
    addLine(slide, 632, 306, 188, 0, C.line, 5);
    addLine(slide, 859, 306, 188, 0, C.line, 5);
    addStepNode(slide, 110, 1, "Upload", "Build a structured candidate profile from the resume.");
    addStepNode(slide, 337, 2, "Configure", "Choose role, level, focus, duration and mode.");
    addStepNode(slide, 564, 3, "Interview", "Answer naturally in Voice or Text mode.");
    addStepNode(slide, 791, 4, "Evaluate", "Review five performance dimensions and question-level feedback.");
    addStepNode(slide, 1018, 5, "Improve", "Follow a personalised learning roadmap and practise again.");
    addText(slide, "Selected mode remains locked for the entire interview session.", { left: 56, top: 610, width: 920, height: 34 }, { fontSize: 22, bold: true, color: C.teal });
    addNotes(slide, "Walk left to right through the candidate experience. Mention that the candidate selects Voice or Text before starting and the mode stays locked during the session, keeping the interview consistent.");
  }

  // 5 — GenAI architecture
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.navy;
    addHeader(slide, "The GenAI engine adapts every interviewer turn", 5, true);
    addText(slide, "Context flows through a server-side orchestration layer—API keys never reach the browser.", { left: 56, top: 150, width: 1000, height: 42 }, { fontSize: 23, color: "#C7D5DC" });
    // Connectors first.
    addLine(slide, 306, 340, 70, 0, "#4B7682", 4);
    addLine(slide, 604, 340, 70, 0, "#4B7682", 4);
    addLine(slide, 902, 340, 70, 0, "#4B7682", 4);
    const boxes = [
      [78, "CANDIDATE CONTEXT", "Resume · role · JD\nfocus · history · time"],
      [376, "AI ORCHESTRATOR", "Acknowledgement\ntransition · next question"],
      [674, "INTERVIEW MODES", "Voice: STT + TTS\nText: typed conversation"],
      [972, "OUTPUT LOOP", "Evaluation report\nlearning roadmap"],
    ];
    boxes.forEach((b, i) => {
      addBox(slide, { left: b[0], top: 250, width: 230, height: 185 }, { fill: i === 1 ? C.teal : C.navy2, lineFill: i === 1 ? C.teal : "#355466", lineWidth: 2 });
      addText(slide, b[1], { left: b[0] + 22, top: 276, width: 186, height: 40 }, { fontSize: 17, bold: true, color: i === 1 ? C.white : C.cyan, alignment: "center" });
      addText(slide, b[2], { left: b[0] + 20, top: 333, width: 190, height: 78 }, { fontSize: 20, color: C.white, alignment: "center", verticalAlignment: "middle" });
    });
    addText(slide, "TanStack Start + React", { left: 80, top: 545, width: 250, height: 32 }, { fontSize: 20, bold: true, color: C.cyan });
    addText(slide, "Supabase Auth · Postgres · Storage", { left: 384, top: 545, width: 350, height: 32 }, { fontSize: 20, bold: true, color: C.cyan });
    addText(slide, "Groq / OpenRouter · server-side", { left: 806, top: 545, width: 380, height: 32 }, { fontSize: 20, bold: true, color: C.cyan });
    addText(slide, "Question selection also changes with answer depth and remaining interview time.", { left: 80, top: 618, width: 1030, height: 34 }, { fontSize: 23, bold: true, color: C.white });
    addNotes(slide, "Explain the architecture at a high level. Candidate context enters a server-side AI orchestrator. It produces a natural interviewer response containing acknowledgement, transition and question. Voice and Text use the same orchestration, while evaluation and reports remain separate.");
  }

  // 6 — Differentiators and outcomes
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.white;
    addHeader(slide, "Realism during the interview, direction after it", 6);
    addLine(slide, 640, 190, 0, 390, C.line, 2);
    addLine(slide, 56, 385, 1168, 0, C.line, 2);
    const items = [
      [56, 190, "Conversational", "Acknowledgement, transition and follow-up make each turn sound professional—not robotic."],
      [686, 190, "Time-aware", "The interviewer balances technical, resume and behavioural topics as time changes."],
      [56, 425, "Evidence-based", "Each answer is reviewed across accuracy, clarity, relevance, problem solving and communication."],
      [686, 425, "Actionable", "Candidates receive strengths, gaps, ideal-answer guidance and a prioritised learning roadmap."],
    ];
    items.forEach((d, i) => {
      addText(slide, `0${i + 1}`, { left: d[0], top: d[1], width: 60, height: 28 }, { fontSize: 17, bold: true, color: C.teal });
      addText(slide, d[2], { left: d[0], top: d[1] + 45, width: 470, height: 40 }, { fontSize: 30, bold: true });
      addText(slide, d[3], { left: d[0], top: d[1] + 100, width: 500, height: 90 }, { fontSize: 21, color: C.muted });
    });
    addText(slide, "The result: a repeatable practice loop built around the individual candidate.", { left: 56, top: 625, width: 1030, height: 38 }, { fontSize: 25, bold: true, color: C.teal });
    addNotes(slide, "Summarise the differentiators. During the interview, PrepPilot focuses on realism and time-aware adaptation. Afterward, it produces structured evidence and clear next steps, creating a repeatable improvement loop.");
  }

  // 7 — Close
  {
    const slide = presentation.slides.add();
    slide.background.fill = C.navy;
    addBox(slide, { left: 0, top: 0, width: 18, height: H }, { fill: C.teal, geometry: "rect" });
    addText(slide, "TEAM PHANTOM · PREPPILOT", { left: 70, top: 58, width: 460, height: 32 }, { fontSize: 18, bold: true, color: C.cyan });
    addText(slide, "Practice that adapts.\nFeedback that guides.", { left: 70, top: 170, width: 900, height: 200 }, { fontSize: 68, bold: true, color: C.white });
    addText(slide, "From resume to ready.", { left: 75, top: 408, width: 600, height: 48 }, { fontSize: 30, color: C.cyan });
    addLine(slide, 70, 520, 1080, 0, "#274557", 2);
    addText(slide, "Suhani Mahajan · Team Leader", { left: 75, top: 560, width: 430, height: 34 }, { fontSize: 22, color: C.white });
    addText(slide, "Divyam Madan · Team Member", { left: 75, top: 605, width: 430, height: 34 }, { fontSize: 22, color: C.white });
    addText(slide, "GEN AI · PROBLEM STATEMENT 2", { left: 770, top: 582, width: 380, height: 32 }, { fontSize: 18, bold: true, color: C.cyan, alignment: "right" });
    addText(slide, "Questions?", { left: 980, top: 52, width: 200, height: 38 }, { fontSize: 24, bold: true, color: C.cyan, alignment: "right" });
    addNotes(slide, "Close by restating the value: PrepPilot adapts practice to the individual and turns interview performance into a concrete improvement plan. Invite the audience to view the live demonstration or ask questions.");
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(`${RENDER_DIR}/slide-${index + 1}.png`, new Uint8Array(await png.arrayBuffer()));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${RENDER_DIR}/slide-${index + 1}.layout.json`, await layout.text());
  }

  const montage = await presentation.export({ format: "png", montage: true, scale: 1 });
  await fs.writeFile(`${RENDER_DIR}/montage.png`, new Uint8Array(await montage.arrayBuffer()));

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT);
  console.log(OUT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
