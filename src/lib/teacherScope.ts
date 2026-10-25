import type { Submission, User } from "./types";

function matchesClassroom(classroom: string, student: User): boolean {
  if (!student.grade || !student.classNo) return false;
  return classroom === `${student.grade}-${student.classNo}` ||
    classroom === `${student.grade}학년 ${student.classNo}반`;
}

// These demo checks do not replace server-side, academic-year-aware authorization.
export function isInTeacherScope(teacher: User, student: User): boolean {
  if (teacher.role === "admin") return student.role === "student";
  if (teacher.role !== "teacher" || student.role !== "student") return false;
  const scope = teacher.teacherScope;
  if (!scope) {
    if (teacher.teacherDuty === "grade_head" || teacher.position === "학년부장") {
      return teacher.grade !== undefined && teacher.grade === student.grade;
    }
    return !!teacher.homeroom &&
      (!teacher.teacherDuty || teacher.teacherDuty === "homeroom" || teacher.teacherDuty === "assistant_homeroom") &&
      matchesClassroom(teacher.homeroom, student);
  }

  // Explicit constraints intersect; school-wide access never overrides a restriction.
  if (scope.grade !== undefined && scope.grade !== student.grade) return false;
  if (scope.classrooms !== undefined && !scope.classrooms.some((room) => matchesClassroom(room, student))) return false;
  if (scope.studentIds !== undefined && (student.studentId === undefined || !scope.studentIds.includes(student.studentId))) return false;
  if (scope.areas !== undefined && scope.areas.length === 0) return false;
  if (scope.itemIds !== undefined && scope.itemIds.length === 0) return false;
  return scope.schoolWide === true ||
    (scope.grade !== undefined && Number.isInteger(scope.grade) && scope.grade > 0) ||
    !!scope.classrooms?.length || !!scope.studentIds?.length ||
    !!scope.areas?.length || !!scope.itemIds?.length;
}

// An area/item assignment is not permission to mutate every resource of a student.
export function canManageStudent(teacher: User, student: User): boolean {
  if (!isInTeacherScope(teacher, student)) return false;
  if (teacher.role === "admin") return true;
  const scope = teacher.teacherScope;
  return scope?.areas === undefined && scope?.itemIds === undefined;
}

export function isSubmissionOfStudent(submission: Submission, student: User): boolean {
  if (submission.studentId === student.id) return true;
  if (student.studentId !== undefined && String(submission.studentId) === String(student.studentId)) return true;
  if (submission.rawStudentId !== undefined && student.studentId !== undefined && submission.rawStudentId === student.studentId) return true;
  return false;
}

export function canReviewSubmission(teacher: User, student: User, submission: Submission, adjust = false): boolean {
  if (!isInTeacherScope(teacher, student) || !isSubmissionOfStudent(submission, student)) return false;
  if (teacher.role === "admin") return true;
  const scope = teacher.teacherScope;
  if (scope?.areas && !scope.areas.includes(submission.area)) return false;
  if (scope?.itemIds && !scope.itemIds.some((id) => String(id).replace(/^item-/, "") === String(submission.itemId).replace(/^item-/, ""))) return false;
  if (adjust && teacher.teacherDuty === "subject_teacher") return false;
  return true;
}
