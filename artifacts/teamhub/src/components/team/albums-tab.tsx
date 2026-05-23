import { useState } from "react";
import { useListAlbums, useCreateAlbum, useDeleteAlbum, useListAlbumFiles, getListAlbumsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ImageIcon, Trash2, ChevronRight, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

function AlbumFilesView({ albumId, teamColor, onClose }: { albumId: number; teamColor: string; onClose: () => void }) {
  const { data: files = [], isLoading } = useListAlbumFiles(albumId);
  const { t } = useI18n();
  const f = t.files;
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl border-border" style={{ background: "var(--surface-card)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-white tracking-wide">{f.albumFilesTitle}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{f.noFilesInAlbum}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
            {files.map(file => (
              <div key={file.id} className="rounded-xl overflow-hidden border border-border" style={{ background: "rgba(255,255,255,0.04)" }}>
                {file.mimeType.startsWith("image/") ? (
                  <img src={file.url} alt={file.originalName} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-white/30" />
                  </div>
                )}
                <p className="text-xs text-white/40 p-2 truncate">{file.originalName}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AlbumsTab({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const f = t.files;

  const { data: albums = [], isLoading } = useListAlbums(teamId);
  const createAlbum = useCreateAlbum();
  const deleteAlbum = useDeleteAlbum();

  function handleCreate() {
    if (!name.trim()) return;
    createAlbum.mutate(
      { teamId, data: { name: name.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey(teamId) });
          setOpen(false);
          setName("");
          toast({ title: f.albumCreated });
        },
        onError: () => toast({ title: f.failedCreateAlbum, variant: "destructive" }),
      }
    );
  }

  function handleDelete(e: React.MouseEvent, albumId: number) {
    e.stopPropagation();
    if (!confirm(f.deleteAlbumConfirm)) return;
    deleteAlbum.mutate({ albumId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey(teamId) });
        toast({ title: f.albumDeleted });
      },
      onError: () => toast({ title: f.failedDeleteAlbum, variant: "destructive" }),
    });
  }

  return (
    <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
      <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" style={{ color: teamColor }} />
          <p className="font-semibold text-white text-sm">{t.teamDetail.tabAlbums}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="font-semibold rounded-xl text-white text-xs" style={{ background: teamColor }}>
              <Plus className="h-3.5 w-3.5 me-1.5" />
              {f.newAlbum}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm border-border" style={{ background: "var(--surface-card)" }}>
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-white tracking-wide">{f.createAlbumTitle.toUpperCase()}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder={f.albumNamePlaceholder}
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
              <Button onClick={handleCreate} disabled={createAlbum.isPending || !name.trim()} className="w-full rounded-xl font-semibold" style={{ background: teamColor }}>
                {createAlbum.isPending ? f.creatingAlbum : f.createAlbumBtn}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-4 space-y-2">
        {isLoading ? (
          [1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)
        ) : albums.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{f.noAlbumsYet}</p>
          </div>
        ) : (
          albums.map(album => (
            <div
              key={album.id}
              onClick={() => setSelectedAlbum(album.id)}
              className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-white/4 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${teamColor}20` }}>
                <ImageIcon className="h-5 w-5" style={{ color: teamColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{album.name}</p>
                <p className="text-xs text-white/40">{album.fileCount} {f.filesCount}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-400 hover:bg-red-400/10 h-7 w-7"
                  onClick={(e) => handleDelete(e, album.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <ChevronRight className="h-4 w-4 text-white/20 flip-rtl" />
              </div>
            </div>
          ))
        )}
      </div>

      {selectedAlbum !== null && (
        <AlbumFilesView
          albumId={selectedAlbum}
          teamColor={teamColor}
          onClose={() => setSelectedAlbum(null)}
        />
      )}
    </div>
  );
}
