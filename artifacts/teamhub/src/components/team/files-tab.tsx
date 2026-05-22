import { useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import {
  useListAlbums, useCreateAlbum, useDeleteAlbum, useListAlbumFiles, useListTeamDocs,
  getListAlbumsQueryKey, getListAlbumFilesQueryKey, getListTeamDocsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, ImageIcon, Trash2, ChevronRight, FolderOpen, FileText, Download,
  Upload, MoreVertical, Pencil, FolderInput, ArrowLeft, X, ZoomIn, Film,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { FileUploader } from "@/components/file-uploader";
import { formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { he, es, enUS } from "date-fns/locale";

const DATE_LOCALES = { he, es, en: enUS };
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type FileRecord = {
  id: number;
  uploaderId: number | null;
  teamId: number | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  relatedType: string | null;
  relatedId: number | null;
  createdAt: string;
};

type Album = { id: number; name: string; fileCount: number };

async function apiDeleteFile(fileId: number) {
  const res = await apiFetch(`${BASE}/api/files/${fileId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete");
}

async function apiRenameFile(fileId: number, originalName: string) {
  const res = await apiFetch(`${BASE}/api/files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify({ originalName }),
  });
  if (!res.ok) throw new Error("Failed to rename");
}

async function apiMoveFile(fileId: number, albumId: number) {
  const res = await apiFetch(`${BASE}/api/files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify({ relatedType: "album", relatedId: albumId }),
  });
  if (!res.ok) throw new Error("Failed to move");
}

function RenameDialog({
  open, onClose, onConfirm, initialName,
}: {
  open: boolean; onClose: () => void; onConfirm: (name: string) => void; initialName: string;
}) {
  const [name, setName] = useState(initialName);
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm border-border" style={{ background: "hsl(226,40%,8%)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-white tracking-wide">Rename File</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-white/6 border-white/10 text-white rounded-xl"
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onConfirm(name.trim())}
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-white/50">Cancel</Button>
            <Button
              onClick={() => onConfirm(name.trim())}
              disabled={!name.trim()}
              className="flex-1 rounded-xl font-semibold text-white"
              style={{ background: "hsl(22,100%,60%)" }}
            >
              Rename
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MoveToAlbumDialog({
  open, onClose, onConfirm, albums,
}: {
  open: boolean; onClose: () => void; onConfirm: (albumId: number) => void; albums: Album[];
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm border-border" style={{ background: "hsl(226,40%,8%)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-white tracking-wide">Move to Album</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {albums.length === 0 && (
            <p className="text-sm text-white/40 text-center py-4">No albums yet</p>
          )}
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => onConfirm(album.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/8 hover:bg-white/4 transition-all text-start"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,107,53,0.12)" }}>
                <ImageIcon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-white">{album.name}</span>
              <span className="text-xs text-white/30 ms-auto">{album.fileCount} files</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileKebab({
  file, albums, onDelete, onRename, onMove,
}: {
  file: FileRecord;
  albums: Album[];
  onDelete: () => void;
  onRename: () => void;
  onMove: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4 text-white/50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="border-border" style={{ background: "hsl(226,40%,10%)" }} align="end">
        <DropdownMenuItem onClick={onRename} className="text-white/80 text-xs cursor-pointer">
          <Pencil className="h-3.5 w-3.5 me-2 text-white/40" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMove} className="text-white/80 text-xs cursor-pointer">
          <FolderInput className="h-3.5 w-3.5 me-2 text-white/40" />
          Move to Album
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/8" />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-400 text-xs cursor-pointer focus:text-red-400 focus:bg-red-400/10"
        >
          <Trash2 className="h-3.5 w-3.5 me-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilePreviewModal({ file, onClose }: { file: FileRecord; onClose: () => void }) {
  const isImage = file.mimeType.startsWith("image/");
  const isVideo = file.mimeType.startsWith("video/");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "hsl(226,40%,8%)", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 shrink-0">
          <p className="text-sm font-semibold text-white truncate pe-4">{file.originalName}</p>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/8"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
          {isImage ? (
            <img
              src={file.url}
              alt={file.originalName}
              className="max-w-full max-h-[70vh] object-contain rounded-xl"
            />
          ) : isVideo ? (
            <video
              src={file.url}
              controls
              className="max-w-full max-h-[70vh] rounded-xl"
            />
          ) : (
            <div className="text-center space-y-4 py-12">
              <div
                className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: "rgba(255,107,53,0.12)" }}
              >
                <FileText className="h-10 w-10 text-primary" />
              </div>
              <div>
                <p className="text-white font-semibold">{file.originalName}</p>
                <p className="text-white/40 text-sm mt-1">{formatBytes(file.size)}</p>
              </div>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
                style={{ background: "hsl(22,100%,60%)" }}
              >
                <Download className="h-4 w-4" />
                Open / Download
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileRow({
  file, albums, onRefresh, teamColor, dateLocale,
}: {
  file: FileRecord;
  albums: Album[];
  onRefresh: () => void;
  teamColor: string;
  dateLocale: Locale;
}) {
  const { toast } = useToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${file.originalName}"?`)) return;
    try {
      await apiDeleteFile(file.id);
      onRefresh();
      toast({ title: "File deleted" });
    } catch {
      toast({ title: "Failed to delete file", variant: "destructive" });
    }
  }

  async function handleRename(newName: string) {
    try {
      await apiRenameFile(file.id, newName);
      setRenameOpen(false);
      onRefresh();
      toast({ title: "File renamed" });
    } catch {
      toast({ title: "Failed to rename file", variant: "destructive" });
    }
  }

  async function handleMove(albumId: number) {
    try {
      await apiMoveFile(file.id, albumId);
      setMoveOpen(false);
      onRefresh();
      toast({ title: "File moved to album" });
    } catch {
      toast({ title: "Failed to move file", variant: "destructive" });
    }
  }

  const isImage = file.mimeType.startsWith("image/");
  const isVideo = file.mimeType.startsWith("video/");

  return (
    <>
      <div
        className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-white/3 transition-all group cursor-pointer"
        onClick={() => setPreviewOpen(true)}
      >
        <div
          className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative"
          style={{ background: `${teamColor}18` }}
        >
          {isImage ? (
            <>
              <img src={file.url} alt={file.originalName} className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </>
          ) : isVideo ? (
            <>
              <Film className="h-5 w-5" style={{ color: teamColor }} />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </>
          ) : (
            <FileText className="h-5 w-5" style={{ color: teamColor }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
            {file.originalName}
          </p>
          <p className="text-xs text-white/40">
            {formatBytes(file.size)} · {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true, locale: dateLocale })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/10"
          >
            <Download className="h-4 w-4 text-white/40" />
          </a>
          <div onClick={(e) => e.stopPropagation()}>
            <FileKebab
              file={file}
              albums={albums}
              onDelete={handleDelete}
              onRename={() => setRenameOpen(true)}
              onMove={() => setMoveOpen(true)}
            />
          </div>
        </div>
      </div>

      {previewOpen && (
        <FilePreviewModal file={file} onClose={() => setPreviewOpen(false)} />
      )}
      <RenameDialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        onConfirm={handleRename}
        initialName={file.originalName}
      />
      <MoveToAlbumDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        onConfirm={handleMove}
        albums={albums}
      />
    </>
  );
}

function AlbumDetailView({
  album, teamId, teamColor, albums, onBack,
}: {
  album: Album; teamId: number; teamColor: string; albums: Album[]; onBack: () => void;
}) {
  const { language } = useI18n();
  const dateLocale = DATE_LOCALES[language as keyof typeof DATE_LOCALES] ?? enUS;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showUploader, setShowUploader] = useState(false);

  const { data: files = [], isLoading, refetch } = useListAlbumFiles(album.id);

  function handleUploaded() {
    queryClient.invalidateQueries({ queryKey: getListAlbumFilesQueryKey(album.id) });
    queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey(teamId) });
    setShowUploader(false);
    toast({ title: "File uploaded" });
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: getListAlbumFilesQueryKey(album.id) });
    queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey(teamId) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Albums
        </button>
        <span className="text-white/20">/</span>
        <span className="text-sm font-semibold text-white">{album.name}</span>
        <div className="ms-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowUploader((v) => !v)}
            className="font-semibold rounded-xl text-white text-xs"
            style={{ background: teamColor }}
          >
            <Upload className="h-3.5 w-3.5 me-1.5" />
            Upload
          </Button>
        </div>
      </div>

      {showUploader && (
        <FileUploader
          teamId={teamId}
          relatedType="album"
          relatedId={album.id}
          onUploaded={handleUploaded}
          accept="image/*,video/*"
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-white/30">
          <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No files in this album yet</p>
          <p className="text-xs mt-1 text-white/20">Click Upload to add photos or videos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(files as FileRecord[]).map((f) => (
            <FileRow
              key={f.id}
              file={f}
              albums={albums.filter((a) => a.id !== album.id)}
              onRefresh={handleRefresh}
              teamColor={teamColor}
              dateLocale={dateLocale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaSection({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const { language } = useI18n();
  const dateLocale = DATE_LOCALES[language as keyof typeof DATE_LOCALES] ?? enUS;
  const [createOpen, setCreateOpen] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: albums = [], isLoading: albumsLoading } = useListAlbums(teamId);
  const createAlbum = useCreateAlbum();
  const deleteAlbum = useDeleteAlbum();

  const teamFilesKey = ["team-files", teamId];
  const { data: teamFiles = [], isLoading: filesLoading, refetch: refetchFiles } = useQuery<FileRecord[]>({
    queryKey: teamFilesKey,
    queryFn: async () => {
      const res = await apiFetch(`${BASE}/api/files?teamId=${teamId}&relatedType=team_file`);
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
  });

  function handleCreateAlbum() {
    if (!albumName.trim()) return;
    createAlbum.mutate(
      { teamId, data: { name: albumName.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey(teamId) });
          setCreateOpen(false);
          setAlbumName("");
          toast({ title: "Album created" });
        },
        onError: () => toast({ title: "Failed to create album", variant: "destructive" }),
      }
    );
  }

  function handleDeleteAlbum(e: React.MouseEvent, albumId: number) {
    e.stopPropagation();
    if (!confirm("Delete this album and all its files?")) return;
    deleteAlbum.mutate({ albumId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey(teamId) });
        toast({ title: "Album deleted" });
      },
      onError: () => toast({ title: "Failed to delete album", variant: "destructive" }),
    });
  }

  function handleFileUploaded() {
    queryClient.invalidateQueries({ queryKey: teamFilesKey });
    setShowUploader(false);
    toast({ title: "File uploaded" });
  }

  function handleFileRefresh() {
    queryClient.invalidateQueries({ queryKey: teamFilesKey });
  }

  if (selectedAlbum !== null) {
    return (
      <AlbumDetailView
        album={selectedAlbum}
        teamId={teamId}
        teamColor={teamColor}
        albums={albums as Album[]}
        onBack={() => setSelectedAlbum(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Files</p>
          <Button
            size="sm"
            onClick={() => setShowUploader((v) => !v)}
            className="font-semibold rounded-xl text-white text-xs"
            style={{ background: teamColor }}
          >
            <Upload className="h-3.5 w-3.5 me-1.5" />
            Upload
          </Button>
        </div>

        {showUploader && (
          <div className="mb-3">
            <FileUploader
              teamId={teamId}
              relatedType="team_file"
              onUploaded={handleFileUploaded}
            />
          </div>
        )}

        <div className="space-y-2">
          {filesLoading ? (
            [1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
            ))
          ) : teamFiles.length === 0 ? (
            <div className="text-center py-6 text-white/30">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No files yet. Upload one above.</p>
            </div>
          ) : (
            teamFiles.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                albums={albums as Album[]}
                onRefresh={handleFileRefresh}
                teamColor={teamColor}
                dateLocale={dateLocale}
              />
            ))
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Albums</p>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="font-semibold rounded-xl text-white text-xs"
            style={{ background: teamColor }}
          >
            <Plus className="h-3.5 w-3.5 me-1.5" />
            New Album
          </Button>
        </div>

        <div className="space-y-2">
          {albumsLoading ? (
            [1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
            ))
          ) : albums.length === 0 ? (
            <div className="text-center py-6 text-white/30">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No albums yet</p>
            </div>
          ) : (
            albums.map((album) => (
              <div
                key={album.id}
                onClick={() => setSelectedAlbum(album as Album)}
                className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-white/4 transition-all group"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${teamColor}20` }}
                >
                  <ImageIcon className="h-5 w-5" style={{ color: teamColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{album.name}</p>
                  <p className="text-xs text-white/40">{album.fileCount} files</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-400 hover:bg-red-400/10 h-7 w-7"
                    onClick={(e) => handleDeleteAlbum(e, album.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-white/20 flip-rtl" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm border-border" style={{ background: "hsl(226,40%,8%)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white tracking-wide">CREATE ALBUM</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Album name"
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
              onKeyDown={(e) => e.key === "Enter" && handleCreateAlbum()}
            />
            <Button
              onClick={handleCreateAlbum}
              disabled={createAlbum.isPending || !albumName.trim()}
              className="w-full rounded-xl font-semibold text-white"
              style={{ background: teamColor }}
            >
              {createAlbum.isPending ? "Creating..." : "Create Album"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocsSection({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const { language } = useI18n();
  const dateLocale = DATE_LOCALES[language as keyof typeof DATE_LOCALES] ?? enUS;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showUploader, setShowUploader] = useState(false);

  const { data: docs = [], isLoading } = useListTeamDocs(teamId);
  const { data: albums = [] } = useListAlbums(teamId);

  function handleUploaded() {
    queryClient.invalidateQueries({ queryKey: getListTeamDocsQueryKey(teamId) });
    setShowUploader(false);
    toast({ title: "Document uploaded" });
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: getListTeamDocsQueryKey(teamId) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="section-label">Documents</p>
        <Button
          size="sm"
          onClick={() => setShowUploader((v) => !v)}
          className="font-semibold rounded-xl text-white text-xs"
          style={{ background: teamColor }}
        >
          <Upload className="h-3.5 w-3.5 me-1.5" />
          Upload
        </Button>
      </div>

      {showUploader && (
        <FileUploader
          teamId={teamId}
          relatedType="team_doc"
          onUploaded={handleUploaded}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        />
      )}

      <div className="space-y-2">
        {isLoading ? (
          [1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
          ))
        ) : docs.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No documents yet</p>
            <p className="text-xs mt-1 text-white/20">Click Upload to add PDFs, spreadsheets, etc.</p>
          </div>
        ) : (
          (docs as FileRecord[]).map((doc) => (
            <FileRow
              key={doc.id}
              file={doc}
              albums={albums as Album[]}
              onRefresh={handleRefresh}
              teamColor={teamColor}
              dateLocale={dateLocale}
            />
          ))
        )}
      </div>
    </div>
  );
}

type SubTab = "media" | "docs";

export default function FilesTab({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const [activeTab, setActiveTab] = useState<SubTab>("media");

  return (
    <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
      <div className="flex border-b border-white/6">
        {([
          { key: "media" as SubTab, label: "Media", icon: ImageIcon },
          { key: "docs" as SubTab, label: "Documents", icon: FileText },
        ] as { key: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors"
            style={{
              color: activeTab === key ? teamColor : "rgba(255,255,255,0.35)",
              borderBottom: activeTab === key ? `2px solid ${teamColor}` : "2px solid transparent",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === "media" ? (
          <MediaSection teamId={teamId} teamColor={teamColor} />
        ) : (
          <DocsSection teamId={teamId} teamColor={teamColor} />
        )}
      </div>
    </div>
  );
}
