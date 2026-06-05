import type { VercelRequest, VercelResponse } from "@vercel/node";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { pgTable, serial, text, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { z } from "zod";

const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  category: text("category").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

function getDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzle(pool, { schema: { transactionsTable } });
}

function formatTx(tx: typeof transactionsTable.$inferSelect) {
  return { ...tx, amount: parseFloat(tx.amount), createdAt: new Date(tx.createdAt).toISOString() };
}

const CreateBody = z.object({
  description: z.string().min(1),
  amount: z.number().min(0),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1),
  date: z.string(),
});

const UpdateBody = CreateBody;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = getDb();
  const { id } = req.query;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const month = typeof req.query.month === "string" ? req.query.month : undefined;
      let rows;
      if (month) {
        rows = await db.select().from(transactionsTable)
          .where(sql`${transactionsTable.date} LIKE ${month + "-%"}`)
          .orderBy(sql`${transactionsTable.date} DESC, ${transactionsTable.createdAt} DESC`);
      } else {
        rows = await db.select().from(transactionsTable)
          .orderBy(sql`${transactionsTable.date} DESC, ${transactionsTable.createdAt} DESC`);
      }
      return res.json(rows.map(formatTx));
    }

    if (req.method === "POST") {
      const parsed = CreateBody.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const [tx] = await db.insert(transactionsTable).values({
        description: parsed.data.description,
        amount: String(parsed.data.amount),
        type: parsed.data.type,
        category: parsed.data.category,
        date: parsed.data.date,
      }).returning();
      return res.status(201).json(formatTx(tx));
    }

    if (req.method === "PUT" && id) {
      const numId = parseInt(String(id), 10);
      if (isNaN(numId)) return res.status(400).json({ error: "Invalid id" });
      const parsed = UpdateBody.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const [tx] = await db.update(transactionsTable).set({
        description: parsed.data.description,
        amount: String(parsed.data.amount),
        type: parsed.data.type,
        category: parsed.data.category,
        date: parsed.data.date,
      }).where(eq(transactionsTable.id, numId)).returning();
      if (!tx) return res.status(404).json({ error: "Not found" });
      return res.json(formatTx(tx));
    }

    if (req.method === "DELETE" && id) {
      const numId = parseInt(String(id), 10);
      if (isNaN(numId)) return res.status(400).json({ error: "Invalid id" });
      const [tx] = await db.delete(transactionsTable)
        .where(eq(transactionsTable.id, numId)).returning();
      if (!tx) return res.status(404).json({ error: "Not found" });
      return res.status(204).end();
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
