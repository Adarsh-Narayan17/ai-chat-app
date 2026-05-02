const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI, FunctionCallingMode } = require("@google/generative-ai");
const Chat = require("../models/Chat");
const { protect } = require("../middleware/authMiddleware");
const { GEMINI_TOOLS, runAgentUntilText } = require("../tools/agentTools");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/** Keeps tools optional: real-time facts when needed; everything else uses model knowledge. */
const CLAIRA_CORE =
  "You are Claira, a helpful and intelligent AI assistant. Use your available tools when necessary to fetch real-time data like weather or current time. For all other general knowledge, technical explanations, coding, or conversational prompts, answer directly using your own internal knowledge. Never treat tools as limits on what you may discuss.";

const PERSONAS = {
  default: `${CLAIRA_CORE} Give clear and concise answers.`,
  coder: `${CLAIRA_CORE} You are an expert coding assistant. Help with code, debugging, and technical questions. Always format code in markdown code blocks with the correct language. Be precise and technical.`,
  teacher: `${CLAIRA_CORE} You are a patient and encouraging teacher. Explain concepts simply with real-world examples and analogies. Break down complex topics step by step. Always check for understanding.`,
  writer: `${CLAIRA_CORE} You are a creative writing assistant. Help with stories, essays, poems, scripts, and creative content. Be imaginative, expressive, and inspiring. Offer suggestions and improvements.`,
  interviewer: `${CLAIRA_CORE} You are a professional interview coach. Help users prepare for job interviews, review their answers, suggest improvements, and provide industry-specific tips. Be constructive and encouraging.`,
};
function streamTextOverSSE(res, text) {
  const chunkSize = 64;
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
  }
}

router.post("/message", protect, async (req, res) => {
  const { message, chatId, imageBase64, imageMimeType, persona } = req.body;

  if (!message && !imageBase64) {
    return res.status(400).json({ message: "Message or image is required" });
  }

  try {
    let chat;
    if (chatId) {
      chat = await Chat.findOne({ _id: chatId, user: req.user._id });
      if (!chat) return res.status(404).json({ message: "Chat not found" });
    } else {
      chat = await Chat.create({
        user: req.user._id,
        title: (message || "Image message").slice(0, 50),
        messages: [],
      });
    }

    const userText = message || "What's in this image?";
    chat.messages.push({ role: "user", content: userText });
    const systemInstruction = PERSONAS[persona] || PERSONAS.default;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Chat-Id", chat._id.toString());
    res.flushHeaders();

    let fullReply = "";

    if (imageBase64) {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction,
      });
      const contentParts = [
        { inlineData: { mimeType: imageMimeType || "image/jpeg", data: imageBase64 } },
        { text: userText },
      ];
      const streamResult = await model.generateContentStream(contentParts);
      for await (const chunk of streamResult.stream) {
        const text = chunk.text();
        if (text) {
          fullReply += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
    } else {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction,
        tools: GEMINI_TOOLS,
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingMode.AUTO,
          },
        },
      });

      const history = chat.messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const chatSession = model.startChat({ history });
      fullReply = await runAgentUntilText(chatSession, message);
      streamTextOverSSE(res, fullReply);
    }

    chat.messages.push({ role: "assistant", content: fullReply });
    await chat.save();
    res.write(`data: ${JSON.stringify({ done: true, chatId: chat._id })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

router.get("/history", protect, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user._id })
      .select("title createdAt updatedAt")
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.user._id });
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json({ message: "Chat deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
