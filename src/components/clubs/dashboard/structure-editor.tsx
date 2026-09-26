"use client";

import { ArrowDown, ArrowUp, CornerDownRight, Plus, Trash2 } from "lucide-react";
import { Fragment, startTransition, useActionState, useState } from "react";

import { OrgChart } from "@/components/clubs/org-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveStructure, type ActionState } from "@/lib/clubs/actions";
import { defaultStructure, descendantIds, MAX_ROLES, newRoleId, roleTree, type ClubRole, type RoleNode } from "@/lib/clubs/profile";

const selectCls =
  "h-7 rounded-md border border-input bg-input/20 px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

const TEMPLATES: Record<string, () => ClubRole[]> = {
  "Board + teams": () => {
    const pres = newRoleId();
    const vp = newRoleId();
    return [
      { id: pres, parentId: null, title: "President", holder: "", description: "", open: false },
      { id: vp, parentId: pres, title: "Vice President", holder: "", description: "", open: false },
      { id: newRoleId(), parentId: pres, title: "Treasurer", holder: "", description: "Finances and member fees", open: false },
      { id: newRoleId(), parentId: vp, title: "Events team", holder: "", description: "", open: true },
      { id: newRoleId(), parentId: vp, title: "Marketing team", holder: "", description: "", open: true },
    ];
  },
  "Simple board": defaultStructure,
};

export function StructureEditor({ slug, initial }: { slug: string; initial: ClubRole[] }) {
  const [roles, setRoles] = useState<ClubRole[]>(initial);
  const [state, action, pending] = useActionState<ActionState, FormData>(saveStructure.bind(null, slug), {});

  const update = (id: string, patch: Partial<ClubRole>) => setRoles((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = (parentId: string | null) =>
    setRoles((rs) => [...rs, { id: newRoleId(), parentId, title: parentId ? "New role" : "New board role", holder: "", description: "", open: false }]);
  // Children of a removed role move up to its parent.
  const remove = (id: string) =>
    setRoles((rs) => {
      const parent = rs.find((r) => r.id === id)?.parentId ?? null;
      return rs.filter((r) => r.id !== id).map((r) => (r.parentId === id ? { ...r, parentId: parent } : r));
    });
  const move = (id: string, dir: -1 | 1) =>
    setRoles((rs) => {
      const me = rs.findIndex((r) => r.id === id);
      const siblings = rs.map((r, i) => [r, i] as const).filter(([r]) => r.parentId === rs[me].parentId);
      const pos = siblings.findIndex(([, i]) => i === me);
      const other = siblings[pos + dir];
      if (!other) return rs;
      const next = [...rs];
      [next[me], next[other[1]]] = [next[other[1]], next[me]];
      return next;
    });

  // A plain render function, not a component: a nested component would remount (and lose input
  // focus) on every keystroke.
  function renderRow(node: RoleNode, depth: number): React.ReactNode {
    const blocked = descendantIds(roles, node.id);
    return (
      <Fragment key={node.id}>
        <li className="rounded-md p-2 ring-1 ring-foreground/10" style={{ marginLeft: `${Math.min(depth, 6) * 1.25}rem` }}>
          <div className="flex flex-wrap items-center gap-1.5">
            {depth > 0 && <CornerDownRight className="size-3.5 text-muted-foreground" />}
            <Input
              value={node.title}
              onChange={(e) => update(node.id, { title: e.target.value })}
              maxLength={80}
              placeholder="Role or team, e.g. Head of Events"
              aria-label="Role title"
              className="h-7 min-w-40 flex-1 font-medium"
            />
            <Input
              value={node.holder}
              onChange={(e) => update(node.id, { holder: e.target.value })}
              maxLength={120}
              placeholder="Name(s), optional"
              aria-label="Held by"
              className="h-7 min-w-32 flex-1"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Input
              value={node.description}
              onChange={(e) => update(node.id, { description: e.target.value })}
              maxLength={300}
              placeholder="What this role does (optional)"
              aria-label="Description"
              className="h-7 min-w-40 flex-1 text-xs"
            />
            <label className="flex items-center gap-1 text-xs/relaxed">
              <input type="checkbox" checked={node.open} onChange={(e) => update(node.id, { open: e.target.checked })} className="accent-[var(--primary)]" />
              Looking for people
            </label>
            <select
              value={node.parentId ?? ""}
              onChange={(e) => update(node.id, { parentId: e.target.value || null })}
              className={selectCls}
              aria-label="Reports to"
            >
              <option value="">Top level</option>
              {roles
                .filter((r) => !blocked.has(r.id))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    ↳ {r.title || "Untitled"}
                  </option>
                ))}
            </select>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(node.id, -1)} aria-label="Move up">
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(node.id, 1)} aria-label="Move down">
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => add(node.id)} disabled={roles.length >= MAX_ROLES}>
              <Plus /> Sub-role
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(node.id)} aria-label="Delete role">
              <Trash2 />
            </Button>
          </div>
        </li>
        {node.children.map((c) => renderRow(c, depth + 1))}
      </Fragment>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hierarchy</CardTitle>
          <CardDescription>
            Board, teams and roles as shown on your public “Team” tab. Mark roles as “looking for people” to advertise open
            positions. Names are optional — only add people who agreed to be listed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
      // Submit via onSubmit instead of `action`: React resets forms after an action, which would snap
      // the controlled selects back to their first option.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-3"
    >
            <input type="hidden" name="roles" value={JSON.stringify(roles)} />
            {roles.length === 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs/relaxed text-muted-foreground">
                Start from a template:
                {Object.entries(TEMPLATES).map(([name, make]) => (
                  <Button key={name} type="button" variant="outline" size="sm" onClick={() => setRoles(make())}>
                    {name}
                  </Button>
                ))}
              </div>
            )}
            <ul className="space-y-1.5">
              {roleTree(roles).map((n) => renderRow(n, 0))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => add(null)} disabled={roles.length >= MAX_ROLES}>
                <Plus /> Top-level role
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save structure"}
              </Button>
              {state.error && <span className="text-xs/relaxed text-destructive">{state.error}</span>}
              {state.message && !pending && <span className="text-xs/relaxed text-primary">{state.message}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
      {roles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <OrgChart roles={roles} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
