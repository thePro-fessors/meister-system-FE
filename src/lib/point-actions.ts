import type { PointRecord, User } from "./types";
import { isInTeacherScope } from "./teacherScope";

export function softDeletePoint(points: PointRecord[], id: string, actor: User, users: User[], at: string): PointRecord[] {
  const point = points.find((p) => p.id === id && !p.deletedAt);
  const student = users.find((u) => u.id === point?.studentId);
  if (!point || !student || !isInTeacherScope(actor, student)) throw new Error("삭제 권한이 없거나 이미 삭제된 기록입니다.");
  return points.map((p) => p.id === id ? { ...p, deletedAt: at, deletedBy: actor.id } : p);
}
