import { useState } from "react";
import { useListAlbums, useCreateAlbum, useDeleteAlbum, useListAlbumFiles, getListAlbumsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ImageIcon, Trash2, ChevronRight, FolderOpen, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

function AlbumFilesView({ albumId, teamColor, onClose }: { albumId: number; teamColor: string; onClose: () => void }) {
  const { data: files = [], isLoading } = useListAlbumFiles(albumId);
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl border-white/10" style={{ background: "#161b2e" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-white tracking-wide">Album Files</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No files in this album yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
            {files.map(f => (
              <div key={f.id} className="rounded-xl overflow-hidden border border-white/8" style={{ background: "rgba(255,255,255,0.04)" }}>
                {f.mimeType.startsWith("image/") ? (
                  <img src={f.url} alt={f.originalName} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-white/30" />
                  </div>
                )}
                <p className="text-xs text-white/40 p-2 truncate">{f.originalName}</p>
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
          toast({ title: "Album created" });
        },
        onError: () => toast({ title: "Failed to create album", variant: "destructive" }),
      }
    );
  }

  function handleDelete(e: React.MouseEvent, albumId: number) {
    e.stopPropagation();
    if (!confirm("Delete this album?")) return;
    deleteAlbum.mutate({ albumId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey(teamId) });
        toast({ title: "Album deleted" });
      },
      onError: () => toast({ title: "Failed to delete album", variant: "destructive" }),
    });
  }

  return (
    <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "rgba(22,27,46,0.8)" }}>
      <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" style={{ color: teamColor }} />
          <p className="font-semibold text-white text-sm">{t.teamDetail.tabAlbums}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="font-semibold rounded-xl text-white text-xs" style={{ background: teamColor }}>
              <Plus className="h-3.5 w-3.5 me-1.5" />
              New Album
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm border-white/10" style={{ background: "#161b2e" }}>
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-white tracking-wide">CREATE ALBUM</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Album name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
              <Button onClick={handleCreate} disabled={createAlbum.isPending || !name.trim()} className="w-full rounded-xl font-semibold" style={{ background: teamColor }}>
                {createAlbum.isPending ? "Creating..." : "Create Album"}
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
            <p className="text-sm">No albums yet</p>
          </div>
        ) : (
          albums.map(album => (
            <div
              key={album.id}
              onClick={() => setSelectedAlbum(album.id)}
              className="flex items-center gap-3 p-3 rounded-xl border border-white/6 cursor-pointer hover:bg-white/4 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${teamColor}20` }}>
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
