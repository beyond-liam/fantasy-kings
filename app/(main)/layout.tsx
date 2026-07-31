import { ContentContainer } from "@/components/layout/content-container";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-1 flex-col">
      <ContentContainer className="flex flex-col">
        {children}
      </ContentContainer>
    </div>
  );
}
