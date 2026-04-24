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
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { TaskNode } from "./TaskNode";
import { useAppStore } from "../store/useAppStore";
import type { Task, TaskId } from "../types";

interface Props {
  rootIds: TaskId[];
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
    setActiveId(event.active.id as TaskId);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || over.id === active.id) return;

    const activeTask = tasks[active.id as TaskId];
    const overTask = tasks[over.id as TaskId];
    if (!activeTask || !overTask) return;

    // Drop in same parent → reorder
    if (activeTask.parentId === overTask.parentId) {
      // Siblings (share parent or both root in same scope)
      if (activeTask.parentId) {
        const siblings = tasks[activeTask.parentId].childrenIds;
        const newIndex = siblings.indexOf(over.id as TaskId);
        moveTask({
          id: active.id as TaskId,
          newParentId: activeTask.parentId,
          newIndex,
        });
        return;
      }
      // Root level of same project
      if (activeTask.projectId === overTask.projectId) {
        const state = useAppStore.getState();
        const scope = activeTask.projectId ?? "inbox";
        const list = state.roots[scope] ?? [];
        const newIndex = list.indexOf(over.id as TaskId);
        moveTask({
          id: active.id as TaskId,
          newParentId: null,
          newProjectId: activeTask.projectId,
          newIndex,
        });
        return;
      }
    }

    // Cross-container move → drop active as sibling of overTask, inserted just before it
    const state = useAppStore.getState();
    if (overTask.parentId) {
      const siblings = state.tasks[overTask.parentId].childrenIds;
      const newIndex = siblings.indexOf(over.id as TaskId);
      moveTask({
        id: active.id as TaskId,
        newParentId: overTask.parentId,
        newIndex,
      });
    } else {
      const scope = overTask.projectId ?? "inbox";
      const list = state.roots[scope] ?? [];
      const newIndex = list.indexOf(over.id as TaskId);
      moveTask({
        id: active.id as TaskId,
        newParentId: null,
        newProjectId: overTask.projectId,
        newIndex,
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
