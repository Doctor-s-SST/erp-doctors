import { Toaster } from "sonner";


export default function FullWidthPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}
    <Toaster richColors position="top-right" /></div>;
}
