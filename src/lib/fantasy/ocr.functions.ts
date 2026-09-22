import { createServerFn } from "@tanstack/react-start";

export type OcrResult = { lines: string[]; teamName: string | null };

/**
 * Reads a fantasy roster screenshot and returns one player per line.
 * Uses the Lovable AI gateway (no API key needed in app code).
 */
export const readRosterImage = createServerFn({ method: "POST" })
  .inputValidator((data: { imageDataUrl: string }) => {
    if (!data.imageDataUrl.startsWith("data:image/")) {
      throw new Error("Please upload an image file.");
    }
    return data;
  })
  .handler(async ({ data }): Promise<OcrResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Image reading is not available right now.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You read screenshots of fantasy football rosters. Return strict JSON only: " +
              '{"teamName": string|null, "players": string[]}. ' +
              "players = every NFL player on the roster, in order, one entry per player, " +
              'formatted as "Full Name POS TEAM" when position and pro team are visible ' +
              '(use "Eagles DEF" style for team defenses). Ignore points, projections, ' +
              "slot labels and empty slots. No markdown, no commentary.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the roster from this screenshot." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Too many image reads at once — wait a moment and try again.");
    if (res.status === 402) throw new Error("Image reading credits are exhausted.");
    if (!res.ok) throw new Error(`Could not read that image (${res.status}).`);

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned) as { teamName?: string | null; players?: string[] };
      return {
        lines: (parsed.players ?? []).filter((l) => typeof l === "string" && l.trim().length > 1),
        teamName: parsed.teamName?.trim() || null,
      };
    } catch {
      return { lines: cleaned.split(/\r?\n/).filter((l) => l.trim().length > 1), teamName: null };
    }
  });
