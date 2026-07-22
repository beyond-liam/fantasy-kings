import { ScoringRuleText } from "@/components/leagues/scoring/scoring-rule-text";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildLeagueScoringSummary } from "@/lib/leagues/league-scoring-summary";
import {
  formatScoringPositions,
  type ScoringPreset,
  type ScoringRule,
  type ScoringRuleDefinition,
} from "@/lib/leagues/scoring";
import { cn } from "@/lib/utils";

type LeagueScoringSummaryProps = {
  scoringPreset: ScoringPreset;
  scoringRules?: ScoringRuleDefinition[] | null;
};

function ScoringDisplayRow({ rule }: { rule: ScoringRule }) {
  const applyLabel = formatScoringPositions(rule.positions);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <ScoringRuleText segments={rule.segments} />
      </div>
      <span
        className={cn(
          "shrink-0 text-xs font-medium tracking-wide uppercase",
          applyLabel === "None" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {applyLabel}
      </span>
    </div>
  );
}

export function LeagueScoringSummary({
  scoringPreset,
  scoringRules,
}: LeagueScoringSummaryProps) {
  const { sections } = buildLeagueScoringSummary({
    scoringPreset,
    scoringRules,
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Scoring</h2>
      {sections.map((section) => (
        <Card key={section.title} size="sm" className="gap-0 py-0">
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="text-base text-balance">
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <ul className="flex flex-col gap-3">
              {section.rules.map((rule) => (
                <li key={rule.id}>
                  <ScoringDisplayRow rule={rule} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
