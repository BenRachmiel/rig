"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <p className="text-sm text-muted-foreground">Page not found</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Go back
        </Button>
        <Link href="/">
          <Button variant="ghost" size="sm">
            Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
