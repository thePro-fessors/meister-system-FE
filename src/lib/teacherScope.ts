import { User } from "./types";

/** 교사의 담당 학급 문자열("1학년 2반")과 학생의 학년/반이 일치하는지 확인한다. */
export function isInTeacherScope(teacher: User, student: User): boolean {
  if (teacher.role !== "teacher" || student.role !== "student") return false;
  if (!teacher.homeroom) return true; // 담임이 아니면 전체 조회 권한을 가진 것으로 간주(간소화)
  return teacher.homeroom === `${student.grade}학년 ${student.classNo}반` ||
    teacher.homeroom === `${student.grade}-${student.classNo}`;
}
