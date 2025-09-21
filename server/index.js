// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// endpoint برای چت
app.post("/chat", async (req, res) => {
  const { message, threadId } = req.body;

  try {
    // اگه ترد جدید می‌خوای
    let thread_id = threadId;
    if (!thread_id) {
      const thread = await client.beta.threads.create();
      thread_id = thread.id;
    }

    // پیام کاربر رو به ترد اضافه کن
    await client.beta.threads.messages.create(thread_id, {
      role: "user",
      content: message,
    });

    // ران کن Assistant رو
    const run = await client.beta.threads.runs.create(thread_id, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // منتظر شو تا تکمیل بشه
    let status;
    do {
      status = await client.beta.threads.runs.retrieve(thread_id, run.id);
      await new Promise((r) => setTimeout(r, 1500));
    } while (status.status !== "completed");

    // پیام‌های ترد رو بخون
    const messages = await client.beta.threads.messages.list(thread_id);

    res.json({ threadId: thread_id, messages: messages.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
