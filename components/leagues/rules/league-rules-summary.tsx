import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildLeagueRulesSummary } from "@/lib/leagues/league-rules-summary";
import type { LeagueRulesSeasonInput } from "@/lib/leagues/league-rules-summary";

type LeagueRulesSummaryProps = {
  season: LeagueRulesSeasonInput;
};

function RulesRow({ label, value }: { label: string; value: string }) {
  const multiline = value.includes("\n");

  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={`text-sm font-medium text-pretty${
          multiline ? " whitespace-pre-line" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function LeagueRulesSummary({ season }: LeagueRulesSummaryProps) {
  const sections = buildLeagueRulesSummary({ season });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Rules</h2>
      {sections.map((section) => (
        <Card key={section.title} size="sm" className="gap-0 py-0">
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="text-base text-balance">
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <dl className="flex flex-col gap-3">
              {section.rows.map((row) => (
                <RulesRow key={row.label} label={row.label} value={row.value} />
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
