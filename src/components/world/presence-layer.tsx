"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { WORLD_SIZE, type Point, type Presence } from "@shared/world";

export interface PresenceLayerHandle {
  updateCursor(clientId: string, point: Point): void;
  removeCursor(clientId: string): void;
  reveal(): void;
  clear(): void;
}

export interface PresenceLayerProps {
  users: Presence[];
}

interface CursorEntry {
  element: HTMLDivElement;
  path: SVGPathElement;
  label: HTMLSpanElement;
}

function createCursorEntry(): CursorEntry {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.style.position = "absolute";
  element.style.transform = "translate(3px, 3px)";
  element.style.pointerEvents = "none";
  element.style.willChange = "left, top";
  element.style.zIndex = "1";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.style.display = "block";
  svg.style.filter = "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25))";

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M2 1.5 14 7.3 8.3 8.6 6.2 14.2Z");
  path.setAttribute("stroke", "#ffffff");
  path.setAttribute("stroke-width", "1.4");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);

  const label = document.createElement("span");
  label.style.position = "absolute";
  label.style.left = "12px";
  label.style.top = "11px";
  label.style.maxWidth = "128px";
  label.style.overflow = "hidden";
  label.style.textOverflow = "ellipsis";
  label.style.whiteSpace = "nowrap";
  label.style.borderRadius = "999px";
  label.style.padding = "1px 6px";
  label.style.fontSize = "10px";
  label.style.fontWeight = "600";
  label.style.lineHeight = "1.5";
  label.style.color = "#ffffff";
  label.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.18)";

  element.appendChild(svg);
  element.appendChild(label);

  return { element, path, label };
}

function applyCursorUser(entry: CursorEntry, user?: Presence): void {
  if (!user) {
    entry.path.setAttribute("fill", "#6f625c");
    entry.label.textContent = "";
    entry.label.hidden = true;
    entry.label.style.backgroundColor = "#6f625c";
    return;
  }

  entry.path.setAttribute("fill", user.color);
  entry.label.textContent = user.name;
  entry.label.hidden = false;
  entry.label.style.backgroundColor = user.color;
}

/**
 * Presence chips and cursors. Cursor movement is imperative: it updates DOM
 * nodes directly and never calls setState.
 */
export const PresenceLayer = forwardRef<PresenceLayerHandle, PresenceLayerProps>(
  function PresenceLayer({ users }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const cursorsRef = useRef(new Map<string, CursorEntry>());
    const usersRef = useRef(users);
    usersRef.current = users;

    useEffect(() => {
      const byId = new Map(users.map((user) => [user.clientId, user]));

      for (const [clientId, entry] of cursorsRef.current) {
        const user = byId.get(clientId);
        if (!user) {
          entry.element.remove();
          cursorsRef.current.delete(clientId);
          continue;
        }
        applyCursorUser(entry, user);
      }
    }, [users]);

    useImperativeHandle(
      ref,
      () => ({
        updateCursor(clientId, point) {
          const root = rootRef.current;
          if (!root) return;

          root.style.visibility = "visible";

          let entry = cursorsRef.current.get(clientId);
          if (!entry) {
            entry = createCursorEntry();
            root.appendChild(entry.element);
            cursorsRef.current.set(clientId, entry);
          }

          const user = usersRef.current.find(
            (candidate) => candidate.clientId === clientId,
          );
          applyCursorUser(entry, user);

          const left = (Math.min(WORLD_SIZE, Math.max(0, point[0])) / WORLD_SIZE) * 100;
          const top = (Math.min(WORLD_SIZE, Math.max(0, point[1])) / WORLD_SIZE) * 100;
          entry.element.style.left = `${left}%`;
          entry.element.style.top = `${top}%`;
        },

        removeCursor(clientId) {
          const entry = cursorsRef.current.get(clientId);
          if (!entry) return;
          entry.element.remove();
          cursorsRef.current.delete(clientId);
        },

        reveal() {
          if (rootRef.current) {
            rootRef.current.style.visibility = "visible";
          }
        },

        clear() {
          for (const entry of cursorsRef.current.values()) {
            entry.element.remove();
          }
          cursorsRef.current.clear();
          if (rootRef.current) {
            rootRef.current.style.visibility = "hidden";
          }
        },
      }),
      [],
    );

    const countLabel =
      users.length <= 1 ? "Bir tek sen varsın" : `${users.length} kişi burada`;

    return (
      <div
        ref={rootRef}
        className="invisible absolute inset-0"
        data-testid="presence-layer"
      >
        <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1">
          <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-[11px] font-semibold text-[color:var(--muted)] shadow-sm">
            {countLabel}
          </span>

          {users.map((user) => (
            <span
              key={user.clientId}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-[11px] font-medium text-[color:var(--foreground)] shadow-sm"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: user.color }}
              />
              {user.name}
            </span>
          ))}
        </div>
      </div>
    );
  },
);

PresenceLayer.displayName = "PresenceLayer";

export default PresenceLayer;
