import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Loader2 className="animate-spin h-8 w-8" />
    </div>
  );
}
