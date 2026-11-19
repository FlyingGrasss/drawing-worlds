"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { createRandomWorld } from "@/lib/worlds/names";

import { rememberWorld } from "./recent-worlds";

export function HeroActions() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function openRandomWorld() {
    if (pending) return;

    setPending(true);
    const world = createRandomWorld();
    rememberWorld({ slug: world.slug, name: world.title });
    router.push(`/w/${world.slug}`);
  }

  function focusJoinField(event: MouseEvent<HTMLAnchorElement>) {
    const field = document.getElementById("join-world");
    if (!(field instanceof HTMLInputElement)) return;

    event.preventDefault();
    field.focus({ preventScroll: true });
    field.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
  }

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        className="btn-primary"
        onClick={openRandomWorld}
        disabled={pending}
        aria-busy={pending || undefined}
      >
        Rastgele dünya aç
      </button>
      <a href="#katil" className="btn-secondary" onClick={focusJoinField}>
        Bağlantıyla katıl
      </a>
    </div>
  );
}
