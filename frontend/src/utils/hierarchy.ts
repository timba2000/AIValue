import type { BusinessUnitWithChildren } from "@/types/business";

export function getDescendantIds(units: BusinessUnitWithChildren[], targetId: string): string[] {
  const descendants: string[] = [];
  
  const findNode = (items: BusinessUnitWithChildren[]): BusinessUnitWithChildren | null => {
    for (const unit of items) {
      if (unit.id === targetId) return unit;
      if (unit.children && unit.children.length > 0) {
        const found = findNode(unit.children);
        if (found) return found;
      }
    }
    return null;
  };
  
  const collectDescendants = (node: BusinessUnitWithChildren) => {
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        descendants.push(child.id);
        collectDescendants(child);
      }
    }
  };
  
  const targetNode = findNode(units);
  if (targetNode) {
    collectDescendants(targetNode);
  }
  
  return [...new Set(descendants)];
}

export function flattenForSelect(
  units: BusinessUnitWithChildren[],
  excludeId?: string,
  maxDepth: number = 3
): Array<{ id: string; name: string; depth: number }> {
  const result: Array<{ id: string; name: string; depth: number }> = [];
  
  const flatten = (items: BusinessUnitWithChildren[]) => {
    for (const unit of items) {
      if (unit.id !== excludeId && unit.depth < maxDepth) {
        result.push({ id: unit.id, name: unit.name, depth: unit.depth });
      }
      if (unit.children && unit.children.length > 0) {
        flatten(unit.children);
      }
    }
  };
  
  flatten(units);
  return result;
}
