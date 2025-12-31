import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, Send, RotateCcw, Wand2, User, Bot, Loader2, Search, Plus, 
  MessageSquare, Trash2, PanelLeftClose, PanelLeft, Brain, ChevronRight,
  Building2, Layers, AlertTriangle, Lightbulb, X, Maximize2, Minimize2
} from "lucide-react";
import { useAISettingsStore } from "@/stores/aiSettingsStore";
import { AIChartRenderer, parseChartSpecs } from "@/components/AIChartRenderer";
import { FileAttachment, FilePreviewInMessage, UploadedFile } from "@/components/FileAttachment";
import { FilterByContext } from "@/components/FilterByContext";
import { useFilterStore } from "../stores/filterStore";
import { useCompanies, useAllBusinessUnits, useAllProcesses } from "../hooks/useApiData";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: UploadedFile[];
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

function parseProcessHierarchy(name: string): { l1: string; l2: string; l3: string } {
  const parts = name.includes(" > ")
    ? name.split(" > ")
    : name.includes(" - ")
      ? name.split(" - ")
      : name.split("/");

  const l1 = parts[0]?.trim() || "-";
  const l2 = parts[1]?.trim() || "-";
  const l3 = parts.slice(2).join(" > ").trim() || "-";
  return { l1, l2, l3 };
}

export default function DashboardHome() {
  const { aiEnabled, persona, rules } = useAISettingsStore();
  const { selectedCompanyId, selectedBusinessUnitId, selectedProcessId, selectedL1Process, selectedL2Process, painPointFilter } = useFilterStore();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [useThinkingModel, setUseThinkingModel] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [aiPanelExpanded, setAiPanelExpanded] = useState(false);

  const { data: companies = [] } = useCompanies();
  const { data: businessUnits = [] } = useAllBusinessUnits();
  const { data: processes = [] } = useAllProcesses();
  
  const { data: painPoints = [] } = useQuery({
    queryKey: ["painPoints"],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/api/pain-points`);
      return response.data;
    }
  });
  
  const { data: useCases = [] } = useQuery({
    queryKey: ["useCases"],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/api/use-cases`);
      return response.data;
    }
  });

  const { data: linkStats = {} } = useQuery<Record<string, number>>({
    queryKey: ["allPainPointLinksStats"],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/api/pain-point-links/stats`);
      return response.data;
    }
  });

  const filteredCompanies = useMemo(() => {
    if (selectedCompanyId) {
      return companies.filter(c => c.id === selectedCompanyId);
    }
    return companies;
  }, [companies, selectedCompanyId]);

  const companyBuIds = useMemo(() => {
    if (!selectedCompanyId) return null;
    return new Set(businessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
  }, [businessUnits, selectedCompanyId]);

  const filteredProcesses = useMemo(() => {
    let filtered = processes;
    
    if (selectedProcessId) {
      return processes.filter(p => p.id === selectedProcessId);
    }
    
    if (selectedBusinessUnitId) {
      filtered = filtered.filter(p => p.businessUnitId === selectedBusinessUnitId);
    } else if (companyBuIds) {
      filtered = filtered.filter(p => companyBuIds.has(p.businessUnitId));
    }
    
    if (selectedL1Process) {
      filtered = filtered.filter(p => {
        const { l1 } = parseProcessHierarchy(p.name);
        return l1 === selectedL1Process;
      });
    }
    
    if (selectedL2Process) {
      filtered = filtered.filter(p => {
        const { l2 } = parseProcessHierarchy(p.name);
        return l2 === selectedL2Process;
      });
    }
    
    return filtered;
  }, [processes, companyBuIds, selectedBusinessUnitId, selectedProcessId, selectedL1Process, selectedL2Process]);

  const filteredProcessIds = useMemo(() => new Set(filteredProcesses.map(p => p.id)), [filteredProcesses]);

  const hasProcessFilter = selectedProcessId || selectedBusinessUnitId || selectedCompanyId || selectedL1Process || selectedL2Process;

  const filteredPainPoints = useMemo(() => {
    let filtered = painPoints;
    
    if (hasProcessFilter) {
      filtered = painPoints.filter((pp: any) => {
        const ppProcessIds = pp.processIds || [];
        return ppProcessIds.length === 0 || ppProcessIds.some((pid: string) => filteredProcessIds.has(pid));
      });
    }
    
    if (painPointFilter === "linked") {
      filtered = filtered.filter((pp: any) => linkStats[pp.id] && linkStats[pp.id] > 0);
    } else if (painPointFilter === "unlinked") {
      filtered = filtered.filter((pp: any) => !linkStats[pp.id] || linkStats[pp.id] === 0);
    }
    
    return filtered;
  }, [painPoints, filteredProcessIds, painPointFilter, linkStats, hasProcessFilter]);

  const filteredUseCases = useMemo(() => {
    if (!hasProcessFilter) {
      return useCases;
    }
    return useCases.filter((uc: any) => !uc.processId || filteredProcessIds.has(uc.processId));
  }, [useCases, filteredProcessIds, hasProcessFilter]);

  const selectedCompanyName = useMemo(() => {
    const company = companies.find(c => c.id === selectedCompanyId);
    return company?.name || null;
  }, [companies, selectedCompanyId]);

  const selectedBusinessUnitName = useMemo(() => {
    const bu = businessUnits.find(b => b.id === selectedBusinessUnitId);
    return bu?.name || null;
  }, [businessUnits, selectedBusinessUnitId]);

  const selectedProcessName = useMemo(() => {
    const process = processes.find(p => p.id === selectedProcessId);
    return process?.name || null;
  }, [processes, selectedProcessId]);

  const filterContextDescription = useMemo(() => {
    const parts: string[] = [];
    if (selectedCompanyName) parts.push(`Company: ${selectedCompanyName}`);
    if (selectedBusinessUnitName) parts.push(`Business Unit: ${selectedBusinessUnitName}`);
    if (selectedProcessName) parts.push(`Process: ${selectedProcessName}`);
    return parts.length > 0 ? parts.join(", ") : "All data";
  }, [selectedCompanyName, selectedBusinessUnitName, selectedProcessName]);

  const fetchConversations = useCallback(async () => {
    try {
      const params = searchQuery ? { search: searchQuery } : {};
      const response = await axios.get(`${API_BASE}/api/ai/conversations`, { 
        params, 
        withCredentials: true 
      });
      setConversations(response.data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (aiEnabled) {
      fetchConversations();
    }
  }, [fetchConversations, aiEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversation = async (id: string) => {
    try {
      const response = await axios.get(`${API_BASE}/api/ai/conversations/${id}`, { 
        withCredentials: true 
      });
      const loadedMessages = response.data.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments || undefined
      }));
      setMessages(loadedMessages);
      setCurrentConversationId(id);
      setError(null);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      setError("Failed to load conversation");
    }
  };

  const saveMessageToConversation = async (conversationId: string, message: Message) => {
    try {
      await axios.post(
        `${API_BASE}/api/ai/conversations/${conversationId}/messages`,
        { 
          role: message.role, 
          content: message.content,
          attachments: message.attachments || null
        },
        { withCredentials: true }
      );
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  };

  const createNewConversation = async (title: string): Promise<string | null> => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/ai/conversations`,
        { title },
        { withCredentials: true }
      );
      const newConversation = response.data;
      setConversations(prev => [newConversation, ...prev]);
      return newConversation.id;
    } catch (err) {
      console.error("Failed to create conversation:", err);
      return null;
    }
  };

  const updateConversationTitle = async (id: string, title: string) => {
    try {
      await axios.put(
        `${API_BASE}/api/ai/conversations/${id}`,
        { title },
        { withCredentials: true }
      );
      setConversations(prev => 
        prev.map(c => c.id === id ? { ...c, title } : c)
      );
    } catch (err) {
      console.error("Failed to update conversation title:", err);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/api/ai/conversations/${id}`, { 
        withCredentials: true 
      });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isThinking || !aiEnabled) return;

    const currentAttachments = [...attachedFiles];
    const userMessage: Message = { 
      role: "user", 
      content: input.trim(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachedFiles([]);
    setError(null);
    setIsThinking(true);

    let conversationId = currentConversationId;
    
    if (!conversationId) {
      const title = input.trim().slice(0, 50) + (input.trim().length > 50 ? "..." : "");
      conversationId = await createNewConversation(title);
      if (conversationId) {
        setCurrentConversationId(conversationId);
      }
    }

    if (conversationId) {
      await saveMessageToConversation(conversationId, userMessage);
    }

    try {
      const attachmentsForAPI = currentAttachments.map(f => ({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        isImage: f.isImage,
        extractedText: f.extractedText,
        base64Data: f.base64Preview,
      }));

      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          config: {
            persona: persona || undefined,
            rules: rules || undefined,
            useThinkingModel,
            attachments: attachmentsForAPI.length > 0 ? attachmentsForAPI : undefined,
            filterContext: {
              companyId: selectedCompanyId || null,
              companyName: selectedCompanyName,
              businessUnitId: selectedBusinessUnitId || null,
              businessUnitName: selectedBusinessUnitName,
              processId: selectedProcessId || null,
              processName: selectedProcessName,
            }
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";
      
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.error) {
                  throw new Error(data.error);
                }
                if (data.content) {
                  fullContent += data.content;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: fullContent };
                    return updated;
                  });
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) continue;
                throw parseErr;
              }
            }
          }
        }
      }

      const assistantMessage: Message = { role: "assistant", content: fullContent };

      if (conversationId) {
        await saveMessageToConversation(conversationId, assistantMessage);
        
        if (messages.length === 0) {
          const aiTitle = fullContent.slice(0, 50) + (fullContent.length > 50 ? "..." : "");
          await updateConversationTitle(conversationId, aiTitle);
        }
      }
    } catch (err: any) {
      console.error("AI chat error:", err);
      const errorMsg = err?.message || "Failed to get AI response";
      setMessages((prev) => prev.filter(m => m.content !== "").slice(0, -1));
      setError(errorMsg);
    } finally {
      setIsThinking(false);
    }
  };

  const handleStartNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setInput("");
    setError(null);
    textareaRef.current?.focus();
  };

  const handleImprovePrompt = async () => {
    if (!input.trim() || isThinking || !aiEnabled) return;
    
    setIsThinking(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Please improve this prompt to be clearer and more specific. Only return the improved prompt, nothing else:\n\n"${input}"`
          }],
          config: {
            persona: "You are a prompt engineering expert. Your job is to take user prompts and make them clearer, more specific, and more effective.",
            rules: "Only return the improved prompt text. Do not include explanations, quotes, or any other text.",
            filterContext: {
              companyId: selectedCompanyId || null,
              companyName: selectedCompanyName,
              businessUnitId: selectedBusinessUnitId || null,
              businessUnitName: selectedBusinessUnitName,
              processId: selectedProcessId || null,
              processName: selectedProcessName,
            }
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let improvedPrompt = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.error) throw new Error(data.error);
                if (data.content) improvedPrompt += data.content;
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) continue;
                throw parseErr;
              }
            }
          }
        }
      }

      setInput(improvedPrompt);
    } catch (err: any) {
      console.error("Improve prompt error:", err);
      setError(err?.message || "Failed to improve prompt");
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    else if (diffDays === 1) return "Yesterday";
    else if (diffDays < 7) return `${diffDays} days ago`;
    else return date.toLocaleDateString();
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] gap-4 p-4 bg-background">
      <div className={cn(
        "flex-1 flex flex-col gap-4 overflow-hidden transition-all duration-300",
        aiPanelExpanded && "hidden md:flex md:w-0 md:opacity-0"
      )}>
        <FilterByContext />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up transition-all duration-200 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Companies</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">{filteredCompanies.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Active businesses</p>
          </div>
          
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up transition-all duration-200 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Processes</p>
              <div className="h-8 w-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Layers className="h-4 w-4 text-indigo-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">{filteredProcesses.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Tracked processes</p>
          </div>
          
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up transition-all duration-200 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Pain Points</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">{filteredPainPoints.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Identified issues</p>
          </div>
          
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up transition-all duration-200 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Solutions</p>
              <div className="h-8 w-8 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Lightbulb className="h-4 w-4 text-green-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">{filteredUseCases.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Potential solutions</p>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20 p-6 shrink-0">
          <h2 className="text-lg font-semibold text-foreground">Welcome to AI_Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Use the filters above to narrow down your view. Ask the AI assistant on the right for insights about your processes and opportunities.
          </p>
        </div>
      </div>

      {aiEnabled && (
        <div className={cn(
          "flex flex-col bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300",
          aiPanelExpanded ? "fixed inset-4 z-50 md:relative md:inset-auto" : aiPanelOpen ? "w-96 lg:w-[450px]" : "w-12"
        )}>
          {!aiPanelOpen ? (
            <button
              onClick={() => setAiPanelOpen(true)}
              className="flex-1 flex items-center justify-center hover:bg-accent transition-colors"
              title="Open AI Assistant"
            >
              <Sparkles className="h-5 w-5 text-primary" />
            </button>
          ) : (
            <>
              <div className="flex border-b border-border">
                <div className={cn(
                  "border-r border-border bg-muted/30 flex flex-col transition-all duration-300 shrink-0",
                  sidebarOpen ? "w-48" : "w-0 overflow-hidden"
                )}>
                  <div className="p-2 border-b border-border">
                    <Button
                      onClick={handleStartNewConversation}
                      className="w-full gap-2 justify-start text-xs"
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="h-3 w-3" />
                      New Chat
                    </Button>
                  </div>
                  
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {loadingConversations ? (
                      <div className="p-3 text-center text-muted-foreground text-xs">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                        Loading...
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="p-3 text-center text-muted-foreground text-xs">
                        {searchQuery ? "No results" : "No chats yet"}
                      </div>
                    ) : (
                      <div className="p-1.5 space-y-0.5">
                        {conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={cn(
                              "group relative flex items-start gap-1.5 p-1.5 rounded-lg cursor-pointer hover:bg-accent transition-colors",
                              currentConversationId === conv.id && "bg-accent"
                            )}
                            onClick={() => loadConversation(conv.id)}
                          >
                            <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate pr-4">
                                {conv.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDate(conv.updatedAt)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                              className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/10 rounded transition-all"
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                    >
                      {sidebarOpen ? (
                        <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <PanelLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={filterContextDescription}>
                        {filterContextDescription}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setAiPanelExpanded(!aiPanelExpanded)}
                      className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                      title={aiPanelExpanded ? "Minimize" : "Maximize"}
                    >
                      {aiPanelExpanded ? (
                        <Minimize2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Maximize2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => setAiPanelOpen(false)}
                      className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                      title="Close AI Panel"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-xs">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-3">
                        <Bot className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground mb-1">How can I help?</h3>
                      <p className="text-muted-foreground text-xs">
                        Ask about your processes, pain points, or solutions. I'm aware of your current filter selection.
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
                        "flex gap-2",
                        message.role === "user" && "flex-row-reverse"
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                          message.role === "user"
                            ? "bg-primary"
                            : "bg-gradient-to-br from-violet-500 to-purple-600"
                        )}
                      >
                        {message.role === "user" ? (
                          <User className="h-3 w-3 text-primary-foreground" />
                        ) : (
                          <Bot className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div
                        className={cn(
                          "max-w-[85%]",
                          message.role === "user" && "text-right"
                        )}
                      >
                        {text && (
                          <div
                            className={cn(
                              "rounded-xl px-3 py-2",
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            )}
                          >
                            {message.role === "user" ? (
                              <>
                                <p className="text-sm whitespace-pre-wrap">{text}</p>
                                {message.attachments && message.attachments.length > 0 && (
                                  <FilePreviewInMessage files={message.attachments} />
                                )}
                              </>
                            ) : (
                              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-background/50 prose-pre:border prose-pre:border-border prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-accent prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1 prose-a:text-primary prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground text-xs">
                                <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{text}</Markdown>
                              </div>
                            )}
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
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                    <div className="bg-muted rounded-xl px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-xs text-red-500">
                    {error}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-border">
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                  <FileAttachment
                    attachedFiles={attachedFiles}
                    onFilesAttached={(files) => setAttachedFiles(prev => [...prev, ...files])}
                    onRemoveFile={(id) => setAttachedFiles(prev => prev.filter(f => f.id !== id))}
                    disabled={isThinking}
                  />
                  <div className="flex gap-1.5">
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about your data..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none pr-20 text-sm"
                        disabled={isThinking}
                      />
                      <div className="absolute right-1.5 bottom-1.5 flex gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleImprovePrompt}
                          disabled={!input.trim() || isThinking}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Improve Prompt"
                        >
                          <Wand2 className="h-3 w-3" />
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!input.trim() || isThinking}
                          className="h-6 w-6 p-0"
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setUseThinkingModel(!useThinkingModel)}
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors",
                        useThinkingModel 
                          ? "bg-violet-500/20 text-violet-500 border border-violet-500/30" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                      title={useThinkingModel ? "Using Thinking Model" : "Using Normal Mode"}
                    >
                      <Brain className="h-3 w-3" />
                      <span>{useThinkingModel ? "Thinking" : "Normal"}</span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleStartNewConversation}
                      className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2"
                    >
                      <RotateCcw className="h-3 w-3" />
                      New
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {!aiEnabled && (
        <div className="w-80 flex items-center justify-center bg-card rounded-2xl border border-border">
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">AI Disabled</h3>
            <p className="text-xs text-muted-foreground">Enable AI features in Admin settings.</p>
          </div>
        </div>
      )}
    </div>
  );
}
