"use client";

import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  onChange: (rating: number) => void;
}

export function StarRating({ rating, onChange }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star === rating ? 0 : star)}
          className="p-1 transition-colors"
        >
          <Star
            className={`size-5 ${
              star <= rating
                ? "fill-foreground/80 text-foreground/80"
                : "text-foreground/20"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
