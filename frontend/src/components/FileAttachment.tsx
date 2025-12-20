import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Image, File, Loader2 } from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileType: string;
  isImage: boolean;
  processingStatus: string;
  extractedText?: string;
  base64Preview?: string;
}

interface FileAttachmentProps {
  onFilesAttached: (files: UploadedFile[]) => void;
  attachedFiles: UploadedFile[];
  onRemoveFile: (id: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <Image className="h-4 w-4" />;
  }
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document")) {
    return <FileText className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

export function FileAttachment({ 
  onFilesAttached, 
  attachedFiles, 
  onRemoveFile,
  disabled 
}: FileAttachmentProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: FileList): File[] => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 25MB limit`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      setError(errors.join(", "));
    }

    return validFiles;
  };

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);

    const formData = new FormData();
    files.forEach(file => formData.append("files", file));

    try {
      const response = await axios.post(`${API_BASE}/api/ai/uploads`, formData, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success && response.data.uploads) {
        onFilesAttached(response.data.uploads);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload files");
    } finally {
      setUploading(false);
    }
  }, [onFilesAttached]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const validFiles = validateFiles(files);
    uploadFiles(validFiles);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const validFiles = validateFiles(files);
      uploadFiles(validFiles);
    }
  }, [uploadFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="space-y-2">
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-lg">
          {attachedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-2 py-1 bg-background rounded-md border border-border text-sm"
            >
              {file.isImage && file.base64Preview ? (
                <img
                  src={`data:${file.mimeType};base64,${file.base64Preview}`}
                  alt={file.originalName}
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                getFileIcon(file.mimeType)
              )}
              <span className="max-w-[120px] truncate text-foreground">
                {file.originalName}
              </span>
              <span className="text-muted-foreground text-xs">
                ({formatFileSize(file.fileSize)})
              </span>
              <button
                onClick={() => onRemoveFile(file.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`relative ${dragOver ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Attach files (images, PDF, Excel, Word)"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && (
        <div className="text-xs text-destructive px-2">
          {error}
        </div>
      )}
    </div>
  );
}

export function FilePreviewInMessage({ files }: { files: UploadedFile[] }) {
  if (!files || files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-md text-sm"
        >
          {file.isImage && file.base64Preview ? (
            <img
              src={`data:${file.mimeType};base64,${file.base64Preview}`}
              alt={file.originalName}
              className="h-16 w-16 rounded object-cover cursor-pointer hover:opacity-80"
              onClick={() => {
                const img = new window.Image();
                img.src = `data:${file.mimeType};base64,${file.base64Preview}`;
                const w = window.open("");
                if (w) {
                  w.document.write(img.outerHTML);
                }
              }}
            />
          ) : (
            <div className="flex items-center gap-2">
              {getFileIcon(file.mimeType)}
              <span className="text-foreground">{file.originalName}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
