import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { TaskNode } from "./TaskNode";
import { useAppStore } from "../store/useAppStore";
import { asTaskId, type ProjectId, type Task, type TaskId } from "../types";

interface Props {
  rootIds: TaskId[];
}

/**
 * Resolve a dnd-kit `UniqueIdentifier` to a known TaskId. Returns `null` for
 * unknown ids (deleted tasks) — never silently casts to a TaskId that has no
 * record in the store.
 */
function resolveTaskId(
  raw: UniqueIdentifier,
  tasks: Record<TaskId, Task>,
): TaskId | null {
  const id = asTaskId(String(raw));
  return tasks[id] ? id : null;
}

export function TaskTree({ rootIds }: Props) {
  const [activeId, setActiveId] = useState<TaskId | null>(null);
  const tasks = useAppStore((s) => s.tasks);
  const moveTask = useAppStore((s) => s.moveTask);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(resolveTaskId(event.active.id, tasks));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || over.id === active.id) return;

    const activeTaskId = resolveTaskId(active.id, tasks);
    const overTaskId = resolveTaskId(over.id, tasks);
    if (!activeTaskId || !overTaskId) return;

    const activeTask = tasks[activeTaskId];
    const overTask = tasks[overTaskId];

    // Same parent → reorder within container.
    if (activeTask.parentId === overTask.parentId) {
      if (activeTask.parentId) {
        const siblings = tasks[activeTask.parentId].childrenIds;
        moveTask({
          id: activeTaskId,
          newParentId: activeTask.parentId,
          newIndex: siblings.indexOf(overTaskId),
        });
        return;
      }
      // Both are roots in the same scope.
      if (activeTask.projectId === overTask.projectId) {
        const list = readScopeRoots(activeTask.projectId);
        moveTask({
          id: activeTaskId,
          newParentId: null,
          newProjectId: activeTask.projectId,
          newIndex: list.indexOf(overTaskId),
        });
        return;
      }
    }

    // Cross-container — drop next to overTask within overTask's container.
    if (overTask.parentId) {
      const siblings = useAppStore.getState().tasks[overTask.parentId].childrenIds;
      moveTask({
        id: activeTaskId,
        newParentId: overTask.parentId,
        newIndex: siblings.indexOf(overTaskId),
      });
    } else {
      const list = readScopeRoots(overTask.projectId);
      moveTask({
        id: activeTaskId,
        newParentId: null,
        newProjectId: overTask.projectId,
        newIndex: list.indexOf(overTaskId),
      });
    }
  };

  const activeTask: Task | null = activeId ? tasks[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-0">
          {rootIds.map((id) => (
            <TaskNode key={id} id={id} depth={0} />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeTask && (
          <div className="rounded-md bg-bg-elevated px-3 py-1.5 text-sm shadow-md ring-1 ring-border">
            {activeTask.title || "Без названия"}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function readScopeRoots(projectId: ProjectId | null): TaskId[] {
  const scope = projectId ?? "inbox";
  return useAppStore.getState().roots[scope] ?? [];
}
