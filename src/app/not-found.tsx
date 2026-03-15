import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="space-y-4">
        <h1
          className="text-6xl font-bold text-[var(--text-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          404
        </h1>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Page Not Found
        </h2>
        <p className="max-w-md text-sm text-[var(--text-secondary)]">
          The page you are looking for does not exist or may have been moved.
        </p>
        <Button
          variant="outline"
          className="gap-2 mt-4"
          render={<Link href="/" />}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
