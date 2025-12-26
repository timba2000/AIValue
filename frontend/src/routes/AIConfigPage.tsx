import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Save, Bot, FileText, Wrench, MessageSquare, Trash2, Loader2, AlertTriangle, CheckSquare, Square } from "lucide-react";
import { Link } from "@/lib/wouter";
import { useAISettingsStore } from "@/stores/aiSettingsStore";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface AdminConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userName: string;
  messageCount: number;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function AIConfigPage() {
  const { isAdmin } = useAuth();
  const { aiEnabled, persona, rules, setPersona, setRules } = useAISettingsStore();
  const [localPersona, setLocalPersona] = useState(persona);
  const [localRules, setLocalRules] = useState(rules);
  const [saved, setSaved] = useState(false);

  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [deletingConversations, setDeletingConversations] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'selected' | 'all' | null>(null);

  useEffect(() => {
    setLocalPersona(persona);
    setLocalRules(rules);
  }, [persona, rules]);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await axios.get(`${API_BASE}/api/ai/admin/conversations`, {
        withCredentials: true
      });
      setConversations(response.data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === conversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      setDeletingConversations(true);
      await axios.delete(`${API_BASE}/api/ai/admin/conversations`, {
        data: { ids: Array.from(selectedIds) },
        withCredentials: true
      });
      setConversations(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete conversations:", err);
    } finally {
      setDeletingConversations(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setDeletingConversations(true);
      await axios.delete(`${API_BASE}/api/ai/admin/conversations/all`, {
        withCredentials: true
      });
      setConversations([]);
      setSelectedIds(new Set());
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete all conversations:", err);
    } finally {
      setDeletingConversations(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSave = () => {
    setPersona(localPersona);
    setRules(localRules);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasChanges = localPersona !== persona || localRules !== rules;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Configuration</h1>
            <p className="text-muted-foreground">Configure the AI assistant's behavior and capabilities</p>
          </div>
        </div>

        {!aiEnabled && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">AI features are currently disabled</p>
              <p className="text-xs text-muted-foreground">Enable AI in admin settings to use these configurations</p>
            </div>
          </div>
        )}

        <div className="grid gap-6">
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Persona</h2>
                <p className="text-sm text-muted-foreground">Define the AI assistant's personality and tone</p>
              </div>
            </div>
            <textarea
              value={localPersona}
              onChange={(e) => setLocalPersona(e.target.value)}
              placeholder="e.g., You are a helpful business analyst assistant. You communicate in a professional yet friendly manner..."
              className="w-full h-32 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Rules</h2>
                <p className="text-sm text-muted-foreground">Set guidelines and constraints for the AI's behavior</p>
              </div>
            </div>
            <textarea
              value={localRules}
              onChange={(e) => setLocalRules(e.target.value)}
              placeholder="e.g., Always prioritize data accuracy. Never make assumptions about business metrics. Ask clarifying questions when information is incomplete..."
              className="w-full h-32 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 opacity-60">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Tools</h2>
                <p className="text-sm text-muted-foreground">Configure which tools the AI can access</p>
              </div>
            </div>
            <div className="flex items-center justify-center py-8 border-2 border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground">Tool configuration coming soon</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Chat History Management</h2>
                  <p className="text-sm text-muted-foreground">View and delete AI conversation history</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm('selected')}
                    className="gap-2 text-red-500 border-red-500/50 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Selected ({selectedIds.size})
                  </Button>
                )}
                {conversations.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm('all')}
                    className="gap-2 text-red-500 border-red-500/50 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete All
                  </Button>
                )}
              </div>
            </div>

            {showDeleteConfirm && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-2">
                      {showDeleteConfirm === 'all' 
                        ? 'Are you sure you want to delete ALL conversations?' 
                        : `Are you sure you want to delete ${selectedIds.size} conversation(s)?`}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      This action cannot be undone. All messages and uploaded files in these conversations will be permanently deleted.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={showDeleteConfirm === 'all' ? handleDeleteAll : handleDeleteSelected}
                        disabled={deletingConversations}
                        className="gap-2"
                      >
                        {deletingConversations && <Loader2 className="h-4 w-4 animate-spin" />}
                        Yes, Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(null)}
                        disabled={deletingConversations}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loadingConversations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex items-center justify-center py-8 border-2 border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground">No conversations found</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-10 p-3 text-left">
                        <button onClick={toggleSelectAll} className="hover:opacity-70">
                          {selectedIds.size === conversations.length ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase">Title</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase">Messages</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {conversations.map((conv) => (
                      <tr key={conv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <button onClick={() => toggleSelect(conv.id)} className="hover:opacity-70">
                            {selectedIds.has(conv.id) ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-foreground truncate max-w-xs" title={conv.title}>
                            {conv.title}
                          </p>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-muted-foreground">{conv.userName}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-muted-foreground">{conv.messageCount}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-sm text-muted-foreground">{formatDate(conv.updatedAt)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className={cn(
              "gap-2 transition-all",
              saved && "bg-green-500 hover:bg-green-600"
            )}
          >
            <Save className="h-4 w-4" />
            {saved ? "Saved!" : "Save Configuration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
