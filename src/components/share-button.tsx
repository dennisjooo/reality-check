"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      title="Copy shareable link"
      className="control-bounce rounded-full"
    >
      {copied ? (
        <Check className="size-3.5 text-green-500" />
      ) : (
        <Link2 className="size-3.5" />
      )}
    </Button>
  );
}
