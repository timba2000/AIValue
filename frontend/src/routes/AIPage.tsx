import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, RotateCcw, Wand2, User, Bot, Loader2 } from "lucide-react";
import { useAISettingsStore } from "@/stores/aiSettingsStore";
import { AIChartRenderer, parseChartSpecs } from "@/components/AIChartRenderer";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIPage() {
  const { aiEnabled, persona, rules } = useAISettingsStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isThinking || !aiEnabled) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsThinking(true);

    try {
      const response = await axios.post(`${API_BASE}/api/ai/chat`, {
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        config: {
          persona: persona || undefined,
          rules: rules || undefined,
        },
      }, { withCredentials: true });

      const assistantMessage: Message = {
        role: "assistant",
        content: response.data.message,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("AI chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to get AI response");
    } finally {
      setIsThinking(false);
    }
  };

  const handleStartNewConversation = () => {
    setMessages([]);
    setInput("");
    setError(null);
    textareaRef.current?.focus();
  };

  const handleImprovePrompt = async () => {
    if (!input.trim() || isThinking || !aiEnabled) return;
    
    setIsThinking(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE}/api/ai/chat`, {
        messages: [{
          role: "user",
          content: `Please improve this prompt to be clearer and more specific. Only return the improved prompt, nothing else:\n\n"${input}"`
        }],
        config: {
          persona: "You are a prompt engineering expert. Your job is to take user prompts and make them clearer, more specific, and more effective.",
          rules: "Only return the improved prompt text. Do not include explanations, quotes, or any other text.",
        },
      }, { withCredentials: true });

      setInput(response.data.message);
    } catch (err) {
      console.error("Improve prompt error:", err);
      setError("Failed to improve prompt");
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!aiEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">AI Features Disabled</h1>
          <p className="text-muted-foreground">Ask an admin to enable AI features in the Admin settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] md:h-screen flex flex-col bg-background">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Ask questions about your data</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleStartNewConversation}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Start New Conversation
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">How can I help you?</h2>
              <p className="text-muted-foreground text-sm">
                Ask me anything about your business processes, pain points, or solutions. I can help you analyze data and provide insights.
              </p>
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const { text, charts } = message.role === "assistant" 
            ? parseChartSpecs(message.content) 
            : { text: message.content, charts: [] };
          
          return (
            <div
              key={index}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  message.role === "user"
                    ? "bg-primary"
                    : "bg-gradient-to-br from-violet-500 to-purple-600"
                )}
              >
                {message.role === "user" ? (
                  <User className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <Bot className="h-4 w-4 text-white" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[80%]",
                  message.role === "user" && "text-right"
                )}
              >
                {text && (
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{text}</p>
                  </div>
                )}
                {charts.map((chart, chartIndex) => (
                  <AIChartRenderer key={chartIndex} spec={chart} />
                ))}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your data..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none pr-24"
                disabled={isThinking}
              />
              <div className="absolute right-2 bottom-2 flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleImprovePrompt}
                  disabled={!input.trim() || isThinking}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  title="Improve Prompt"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || isThinking}
                  className="h-8 px-3 gap-1"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleImprovePrompt}
              disabled={!input.trim() || isThinking}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Wand2 className="h-4 w-4" />
              Improve Prompt
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
