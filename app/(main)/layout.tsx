import { ContentContainer } from "@/components/layout/content-container";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-none">
      <ContentContainer className="flex flex-col">
        {children}
      </ContentContainer>
    </div>
  );
}
