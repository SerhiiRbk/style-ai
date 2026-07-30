"use client";

import { Component, type ReactNode } from "react";

/**
 * Guards the interactive navbar against crashes caused by browser translation
 * extensions (DeepL, Google Translate) that mutate text nodes and break React's
 * hydration/commit (typically a `removeChild` NotFoundError). Without a boundary
 * such an error unmounts the whole nav subtree, leaving only the logo. If a child
 * throws, we render a minimal static fallback so navigation still works.
 */
export class NavErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Intentionally swallowed: this is almost always third-party DOM tampering,
    // not an app fault. The fallback keeps the menu usable.
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
