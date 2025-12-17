import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Save, Bot, FileText, Wrench } from "lucide-react";
import { Link } from "@/lib/wouter";
import { useAISettingsStore } from "@/stores/aiSettingsStore";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function AIConfigPage() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const { aiEnabled, persona, rules, setPersona, setRules } = useAISettingsStore();
  const [localPersona, setLocalPersona] = useState(persona);
  const [localRules, setLocalRules] = useState(rules);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    setLocalPersona(persona);
    setLocalRules(rules);
  }, [persona, rules]);

  const handleSave = () => {
    setPersona(localPersona);
    setRules(localRules);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasChanges = localPersona !== persona || localRules !== rules;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
