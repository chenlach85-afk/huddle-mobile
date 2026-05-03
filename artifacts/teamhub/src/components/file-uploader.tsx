import { useRef, useState } from "react";
import { Upload, X, FileImage, Film, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  id: number;
  filename: string;
  url: string;
  mimeType: string;
}

interface FileUploaderProps {
  teamId?: number;
  relatedType?: string;
  relatedId?: number;
  onUploaded?: (file: UploadedFile) => void;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return Film;
  return FileText;
}

async function uploadFile(params: {
  file: globalThis.File;
  teamId?: number;
  relatedType?: string;
  relatedId?: number;
}): Promise<UploadedFile> {
  const { file, teamId, relatedType, relatedId } = params;

  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch(`${BASE}/api/files/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      data,
      teamId,
      relatedType,
      relatedId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Upload failed");
  }

  return res.json();
}

export function FileUploader({
  teamId,
  relatedType,
  relatedId,
  onUploaded,
  accept = "image/*,video/*,.pdf,.doc,.docx",
  maxSizeMB = 10,
  className,
}: FileUploaderProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Max ${maxSizeMB}MB.`);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadFile({ file, teamId, relatedType, relatedId });
      onUploaded?.(uploaded);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all",
          dragOver
            ? "border-primary/60 bg-primary/8"
            : "border-white/15 hover:border-white/30 bg-white/3",
          uploading && "opacity-60 pointer-events-none",
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {uploading ? (
          <>
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <p className="text-white/60 text-sm">{t.files.uploading}</p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center">
              <Upload className="h-5 w-5 text-white/50" />
            </div>
            <div className="text-center">
              <p className="text-white/70 text-sm font-medium">{t.files.selectFile}</p>
              <p className="text-white/35 text-xs mt-0.5">{t.files.dragDrop}</p>
              <p className="text-white/25 text-xs mt-1">{t.files.maxSize}</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-2 text-red-400 text-xs">
          <X className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

interface FilePreviewProps {
  files: UploadedFile[];
  onRemove?: (id: number) => void;
}

export function FilePreviewList({ files, onRemove }: FilePreviewProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((f) => {
        const Icon = getFileIcon(f.mimeType);
        const isImage = f.mimeType.startsWith("image/");
        const isVideo = f.mimeType.startsWith("video/");

        return (
          <div
            key={f.id}
            className="relative group rounded-xl overflow-hidden border border-white/10"
            style={{ width: 80, height: 80 }}
          >
            {isImage ? (
              <img src={f.url} alt={f.filename} className="w-full h-full object-cover" />
            ) : isVideo ? (
              <video src={f.url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-1">
                <Icon className="h-6 w-6 text-white/40" />
                <span className="text-[9px] text-white/30 px-1 truncate w-full text-center">
                  {f.filename}
                </span>
              </div>
            )}
            {onRemove && (
              <button
                onClick={() => onRemove(f.id)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
