import { Spinner } from "@/components/ui/spinner";

export function PageSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
