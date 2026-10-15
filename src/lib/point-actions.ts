import type { PointRecord, User } from "./types";
import { canManageStudent } from "./teacherScope";

export function validPointMagnitude(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 5;
}

export function canModifyPoint(actor: User, point: PointRecord, student: User): boolean {
  return !point.deletedAt && canManageStudent(actor, student) &&
    (actor.role === "admin" || actor.teacherDuty === "grade_head" ||
      actor.teacherDuty === "vice_principal" || point.teacherId === actor.id);
}

export function softDeletePoint(points: PointRecord[], id: string, actor: User, users: User[], at: string): PointRecord[] {
  const point = points.find((p) => p.id === id && !p.deletedAt);
  const student = users.find((u) => u.id === point?.studentId);
  if (!point || !student || !canModifyPoint(actor, point, student)) throw new Error("삭제 권한이 없거나 이미 삭제된 기록입니다.");
  return points.map((p) => p.id === id ? { ...p, deletedAt: at, deletedBy: actor.id } : p);
}
