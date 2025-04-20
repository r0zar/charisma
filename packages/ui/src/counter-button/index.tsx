"use client";

import { useState } from "react";
import { cn } from "../utils";

export function CounterButton({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  return (
    <div className={cn("bg-black/5 rounded-lg p-6 font-medium", className)}>
      <p className="mb-6">
        This component is from{" "}
        <code className="px-[0.2rem] py-[0.3rem] bg-black/10 rounded-md">
          ui
        </code>
      </p>
      <div>
        <button
          onClick={() => {
            setCount((c) => c + 1);
          }}
          className="bg-black text-white border-none py-2 px-4 rounded inline-block cursor-pointer hover:bg-black/80 transition-colors"
          type="button"
        >
          Count: {count}
        </button>
      </div>
    </div>
  );
}
