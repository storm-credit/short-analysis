'use client';

interface LoadingOverlayProps {
  show: boolean;
  text?: string;
}

export default function LoadingOverlay({ show, text }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-[#FBFBFD]/90 dark:bg-black/90 backdrop-blur-2xl z-[99999] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-[3px] border-black/[0.08] dark:border-white/[0.08] border-t-[#0071E3] dark:border-t-[#0A84FF] rounded-full animate-spin" />
      <div className="text-[15px] text-[#86868B] font-medium">{text || 'Loading...'}</div>
    </div>
  );
}
