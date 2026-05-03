import { useListTeamDocs } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, FolderOpen } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { he, es, enUS } from "date-fns/locale";

const DATE_LOCALES = { he, es, en: enUS };

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DocsTab({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const { t, language } = useI18n();
  const dateLocale = DATE_LOCALES[language] ?? enUS;
  const { data: docs = [], isLoading } = useListTeamDocs(teamId);

  return (
    <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "rgba(22,27,46,0.8)" }}>
      <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
        <FileText className="h-4 w-4" style={{ color: teamColor }} />
        <p className="font-semibold text-white text-sm">{t.teamDetail.tabDocs}</p>
      </div>

      <div className="p-4 space-y-2">
        {isLoading ? (
          [1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)
        ) : docs.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No documents yet</p>
          </div>
        ) : (
          docs.map(doc => (
            <a
              key={doc.id}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl border border-white/6 hover:bg-white/4 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${teamColor}20` }}>
                <FileText className="h-5 w-5" style={{ color: teamColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{doc.originalName}</p>
                <p className="text-xs text-white/40">
                  {formatBytes(doc.size)} · {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true, locale: dateLocale })}
                </p>
              </div>
              <Download className="h-4 w-4 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
            </a>
          ))
        )}
      </div>
    </div>
  );
}
