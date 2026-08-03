export type FillerWordBreakdown = {
  phrase: string;
  count: number;
};

export type FillerWordAnalysis = {
  total: number;
  wordCount: number;
  ratePer100Words: number;
  answerCount: number;
  answersWithFillers: number;
  breakdown: FillerWordBreakdown[];
  feedback: string;
};

// Longer phrases are checked first so "you know" is counted once, not as
// separate tokens. This is intentionally deterministic: filler usage does not
// depend on an AI response and cannot affect interview scores.
const FILLER_PHRASES = [
  "you know",
  "i mean",
  "kind of",
  "sort of",
  "basically",
  "actually",
  "literally",
  "like",
  "erm",
  "hmm",
  "um",
  "uh",
] as const;

const TOKEN_PATTERN = /[a-z]+(?:'[a-z]+)?/g;

function tokenize(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .match(TOKEN_PATTERN) ?? []
  );
}

function countFillers(text: string) {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();
  const phraseTokens = FILLER_PHRASES.map((phrase) => ({ phrase, tokens: phrase.split(" ") }));

  for (let index = 0; index < tokens.length;) {
    const match = phraseTokens.find(({ tokens: candidate }) =>
      candidate.every((token, offset) => tokens[index + offset] === token),
    );

    if (!match) {
      index += 1;
      continue;
    }

    counts.set(match.phrase, (counts.get(match.phrase) ?? 0) + 1);
    index += match.tokens.length;
  }

  return { tokens, counts };
}

export function analyzeFillerWords(answers: string[]): FillerWordAnalysis {
  const combinedCounts = new Map<string, number>();
  let wordCount = 0;
  let answersWithFillers = 0;

  for (const answer of answers) {
    const { tokens, counts } = countFillers(answer);
    wordCount += tokens.length;

    const answerTotal = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
    if (answerTotal > 0) answersWithFillers += 1;

    for (const [phrase, count] of counts) {
      combinedCounts.set(phrase, (combinedCounts.get(phrase) ?? 0) + count);
    }
  }

  const breakdown = Array.from(combinedCounts, ([phrase, count]) => ({ phrase, count })).sort(
    (a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase),
  );
  const total = breakdown.reduce((sum, item) => sum + item.count, 0);
  const ratePer100Words = wordCount ? Math.round((total / wordCount) * 1000) / 10 : 0;
  const topFiller = breakdown[0]?.phrase;

  let feedback = "No common filler words were detected. Keep the same deliberate pace.";
  if (ratePer100Words > 0 && ratePer100Words <= 2) {
    feedback = `Filler usage was minimal${topFiller ? `; “${topFiller}” appeared most often` : ""}.`;
  } else if (ratePer100Words <= 5 && total > 0) {
    feedback = `Filler usage was moderate. Pause briefly instead of using “${topFiller}”.`;
  } else if (ratePer100Words > 5) {
    feedback = `Filler words were frequent. Practice silent pauses, especially where you used “${topFiller}”.`;
  }

  return {
    total,
    wordCount,
    ratePer100Words,
    answerCount: answers.length,
    answersWithFillers,
    breakdown,
    feedback,
  };
}
