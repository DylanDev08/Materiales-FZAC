"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export const ASSISTANT_OPEN_EVENT = "fzac-assistant:open";

export type AssistantOpenDetail = {
  message?: string;
};

export function AssistantLauncher({
  prompt,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { prompt: string; children: ReactNode }) {
  return (
    <button
      {...props}
      type="button"
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;
        window.dispatchEvent(new CustomEvent<AssistantOpenDetail>(ASSISTANT_OPEN_EVENT, { detail: { message: prompt } }));
      }}
    >
      {children}
    </button>
  );
}
