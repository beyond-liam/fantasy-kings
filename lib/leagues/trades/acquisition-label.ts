export function formatAcquisitionLabel(input: {
  draftRound: number | null;
  wasDrafted: boolean;
}) {
  if (input.wasDrafted && input.draftRound != null) {
    return String(input.draftRound);
  }
  return "FA";
}
