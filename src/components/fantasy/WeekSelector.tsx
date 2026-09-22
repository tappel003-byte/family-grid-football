import { WEEKS } from "@/lib/fantasy/league";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WeekSelector({
  week,
  onChange,
}: {
  week: number;
  onChange: (week: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous week"
        disabled={week <= 1}
        onClick={() => onChange(week - 1)}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Select value={String(week)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-10 w-[140px] text-base font-semibold" aria-label="Select week">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WEEKS.map((w) => (
            <SelectItem key={w} value={String(w)} className="text-base">
              Week {w}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next week"
        disabled={week >= 18}
        onClick={() => onChange(week + 1)}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
