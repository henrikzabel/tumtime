import { UserPlus } from "lucide-react";

import { roleTree, type ClubRole, type RoleNode } from "@/lib/clubs/profile";
import { cn } from "@/lib/utils";

function RoleCard({ node, level }: { node: RoleNode; level: number }) {
  return (
    <div
      className={cn(
        "w-48 rounded-lg border bg-card px-3 py-2 text-center shadow-xs",
        level === 0 && "border-foreground/25",
        node.open && "border-dashed border-primary",
      )}
    >
      <div className="text-sm font-semibold">{node.title}</div>
      <div className={cn("text-xs/relaxed", node.holder ? "text-foreground" : "text-muted-foreground italic")}>
        {node.holder || (node.open ? "Open position" : "—")}
      </div>
      {node.description && <p className="mt-1 text-[0.6875rem] text-muted-foreground">{node.description}</p>}
      {node.open && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/12 px-1.5 text-[0.625rem] font-semibold text-primary">
          <UserPlus className="size-2.5" /> Looking for people
        </span>
      )}
    </div>
  );
}

/** Top-down org chart; wide trees scroll horizontally. */
function Branch({ node, level }: { node: RoleNode; level: number }) {
  return (
    <li className="flex flex-col items-center">
      <RoleCard node={node} level={level} />
      {node.children.length > 0 && (
        <>
          <span aria-hidden className="h-4 w-px bg-border" />
          <ul className="flex gap-4">
            {node.children.map((c, i) => (
              <li key={c.id} className="relative flex flex-col items-center pt-4">
                {/* horizontal rail between siblings */}
                {node.children.length > 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0 h-px bg-border",
                      i === 0 ? "right-[-0.5rem] left-1/2" : i === node.children.length - 1 ? "right-1/2 left-[-0.5rem]" : "-inset-x-2",
                    )}
                  />
                )}
                <span aria-hidden className="absolute top-0 left-1/2 h-4 w-px bg-border" />
                <ul>
                  <Branch node={c} level={level + 1} />
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export function OrgChart({ roles }: { roles: ClubRole[] }) {
  const tree = roleTree(roles);
  if (tree.length === 0) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <ul className="mx-auto flex w-max gap-8" aria-label="Club structure">
        {tree.map((n) => (
          <Branch key={n.id} node={n} level={0} />
        ))}
      </ul>
    </div>
  );
}
