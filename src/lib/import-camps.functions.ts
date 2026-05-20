import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sessionSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  registration_deadline: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  age_min: z.number().nullable().optional(),
  age_max: z.number().nullable().optional(),
  available_spots: z.number().nullable().optional(),
  registration_url: z.string().nullable().optional(),
});

export const importCampsFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string }) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    // Fetch the page
    let html = "";
    try {
      const res = await fetch(data.url, {
        headers: { "User-Agent": "Mozilla/5.0 SummerBuddyConnect/1.0" },
      });
      if (!res.ok) throw new Error(`Failed to fetch site (${res.status})`);
      html = await res.text();
    } catch (e: any) {
      throw new Error(e.message ?? "Could not load website");
    }

    // Strip scripts/styles, collapse whitespace, cap length
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 18000);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract summer camp sessions from a vendor's website text. Return a JSON object {sessions: [...]}. Each session has fields: title, description, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), registration_deadline (YYYY-MM-DD or null), location, postal_code, price (number USD), age_min, age_max, available_spots (number or null), registration_url. If a field is unknown, use null. Only return sessions you are confident exist on the page.",
          },
          {
            role: "user",
            content: `Source URL: ${data.url}\n\nPage text:\n${text}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const body = await aiRes.text().catch(() => "");
      if (aiRes.status === 429) throw new Error("AI rate limit hit — try again in a moment.");
      if (aiRes.status === 402)
        throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI extraction failed (${aiRes.status}): ${body.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returned malformed JSON");
    }

    const rawList = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    const sessions = rawList
      .map((s: any) => {
        try {
          return sessionSchema.parse(s);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return { sessions };
  });
