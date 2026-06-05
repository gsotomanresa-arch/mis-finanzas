import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const VALID_CATEGORY_IDS = [
  "salary", "freelance", "investment", "other_income",
  "food", "transport", "housing", "health", "entertainment",
  "shopping", "education", "restaurant", "subscriptions", "other_expense",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { description } = req.body as { description?: string };
  if (!description || typeof description !== "string" || description.trim().length < 2) {
    return res.status(400).json({ error: "description is required" });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 50,
      messages: [{
        role: "user",
        content: `Clasifica esta transacción financiera. Responde SOLO con el ID de categoría, sin explicación ni puntuación.\n\nDescripción: "${description.trim()}"\n\nIDs válidos: salary, freelance, investment, other_income, food, transport, housing, health, entertainment, shopping, education, restaurant, subscriptions, other_expense`,
      }],
    });
    const block = message.content[0];
    const raw = block.type === "text" ? block.text.trim().toLowerCase().replace(/[^a-z_]/g, "") : "";
    const categoryId = VALID_CATEGORY_IDS.includes(raw) ? raw : "other_expense";
    return res.json({ categoryId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Classification failed" });
  }
}
