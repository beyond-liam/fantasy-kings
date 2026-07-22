import { cn } from "@/lib/utils";

type ContentContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function ContentContainer({
  children,
  className,
}: ContentContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-screen-2xl", className)}>
      {children}
    </div>
  );
}
