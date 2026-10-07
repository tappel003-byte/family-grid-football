import { Link } from "@tanstack/react-router";
import { Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLeague } from "@/lib/fantasy/hooks";
import type { CommissionerAnnouncement as Announcement } from "@/lib/fantasy/rules";

const seenKey = (id: string) => `la-familia-announcement-seen-${id}`;

/** Soft banner — not a blocking nag. Tap opens Chat; X dismisses for this device. */
export function CommissionerAnnouncementBanner() {
  const { league } = useLeague();
  const ann = league?.rules.announcement ?? null;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!ann) {
      setDismissed(true);
      return;
    }
    setDismissed(Boolean(localStorage.getItem(seenKey(ann.id))));
  }, [ann?.id]);

  if (!ann || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(seenKey(ann.id), "1");
    setDismissed(true);
  };

  return (
    <div className="border-b border-primary/25 bg-primary/10">
      <div className="mx-auto flex w-full min-w-0 max-w-[1400px] items-start gap-2 px-3 py-2.5 sm:px-4">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <Link
          to="/chat"
          onClick={dismiss}
          className="min-w-0 flex-1 text-left text-sm leading-snug text-foreground"
        >
          <span className="font-semibold">From {ann.authorName}: </span>
          <span className="break-words">{ann.body}</span>
          <span className="mt-0.5 block text-xs font-semibold text-primary">Open chat →</span>
        </Link>
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function announcementPreview(ann: Announcement | null) {
  if (!ann) return "No announcement posted.";
  return `From ${ann.authorName}: ${ann.body}`;
}
