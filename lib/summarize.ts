import Groq from "groq-sdk";

const SYSTEM_INSTRUCTION = `You are a transcript summarizer. Given a YouTube video transcript, produce TWO summaries:

1. BULLETS: 3-7 key takeaway bullet points. Each bullet should be a single concise sentence capturing a distinct main point. Use "- " prefix for each bullet.

2. PARAGRAPH: A cohesive 3-5 sentence paragraph summary covering the main topics and conclusions.

Format your response EXACTLY as:
BULLETS:
- [point 1]
- [point 2]
...

PARAGRAPH:
[paragraph text]`;

const MODEL = "llama-3.3-70b-versatile";
const MAX_CHARS = 120_000; // ~30K tokens, well within Groq's 128K context

export function parseSummaryResponse(text: string): {
  bullets: string;
  paragraph: string;
} {
  const bulletMatch = text.match(/BULLETS:\s*([\s\S]*?)(?=PARAGRAPH:|$)/i);
  const paragraphMatch = text.match(/PARAGRAPH:\s*([\s\S]*?)$/i);

  let bullets = bulletMatch?.[1]?.trim() ?? "";
  let paragraph = paragraphMatch?.[1]?.trim() ?? "";

  // Fallback: if delimiters are missing, look for lines starting with "- " for bullets
  if (!bullets && !paragraph) {
    const lines = text.split("\n");
    const bulletLines: string[] = [];
    const otherLines: string[] = [];

    for (const line of lines) {
      if (line.trimStart().startsWith("- ") || line.trimStart().startsWith("* ")) {
        bulletLines.push(line);
      } else if (line.trim()) {
        otherLines.push(line);
      }
    }

    bullets = bulletLines.join("\n");
    paragraph = otherLines.join("\n");
  }

  // Final fallback: treat entire response as paragraph
  if (!bullets && !paragraph) {
    return { bullets: "", paragraph: text.trim() };
  }

  return { bullets, paragraph };
}

function createClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }
  return new Groq({ apiKey });
}

export async function generateSummary(
  transcriptText: string
): Promise<{ bullets: string; paragraph: string }> {
  const groq = createClient();

  // Truncate if extremely long (shouldn't happen for normal videos)
  const input = transcriptText.length > MAX_CHARS
    ? transcriptText.slice(0, MAX_CHARS)
    : transcriptText;

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: input },
    ],
    temperature: 0.3,
  });

  const text = response.choices[0]?.message?.content ?? "";
  return parseSummaryResponse(text);
}
