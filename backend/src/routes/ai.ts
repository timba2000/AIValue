import { Router, Request, Response } from "express";
import { generateChatResponse, ChatMessage, AIConfig } from "../services/aiService.js";

const router = Router();

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { messages, config } = req.body as {
      messages: ChatMessage[];
      config?: AIConfig;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    const response = await generateChatResponse(messages, config);
    
    res.json({ 
      success: true,
      message: response 
    });
  } catch (error) {
    console.error("AI chat error:", error);
    res.status(500).json({ 
      error: "Failed to generate AI response",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.get("/status", (_req: Request, res: Response) => {
  const hasApiKey = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const hasBaseUrl = !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  
  res.json({
    configured: hasApiKey && hasBaseUrl,
    ready: hasApiKey && hasBaseUrl,
  });
});

export default router;
