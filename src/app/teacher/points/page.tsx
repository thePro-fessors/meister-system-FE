"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { PageHeader } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { canManageStudent } from "@/lib/teacherScope";
import { canModifyPoint, validPointMagnitude } from "@/lib/point-actions";
import { PointType } from "@/lib/types";
import { academicYear } from "@/lib/grading";
import { DeletePointButton } from "@/components/DeletePointButton";

export default function TeacherPointsPage() {
  const { user } = useAuth();
  const { users, points, addPoint, updatePoint } = useData();

  const scopedStudents = useMemo(
    () => (user ? users.filter((u) => u.role === "student" && canManageStudent(user, u)) : []),
    [users, user]
  );

  const [studentId, setStudentId] = useState(scopedStudents[0]?.id ?? "");
  const [type, setType] = useState<PointType>("상점");
  const [score, setScore] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editScore, setEditScore] = useState(0);

  const scopedIds = new Set(scopedStudents.map((s) => s.id));
  const list = points
    .filter((p) => scopedIds.has(p.studentId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const studentName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setFormError("상벌점 부여 사유를 입력해 주세요.");
      return;
    }
    if (!user || !scopedIds.has(studentId)) {
      setFormError("학생을 선택해 주세요.");
      return;
    }
    if (!date || !validPointMagnitude(score)) {
      setFormError("발생일과 1~5의 정수 점수를 입력해 주세요.");
      return;
    }
    setFormError(null);
    addPoint({
      id: `pt-${Date.now()}`,
      studentId,
      type,
      score: type === "상점" ? Math.abs(score) : -Math.abs(score),
      reason,
      date,
      year: academicYear(date),
      teacherId: user!.id,
      reflected: false,
    });
    setReason("");
    setScore(1);
  }

  function startEdit(id: string, currentScore: number) {
    setEditingId(id);
    setEditScore(Math.abs(currentScore));
    setEditReason("");
  }

  function saveEdit(id: string, type: PointType) {
    const point = list.find((p) => p.id === id);
    const student = users.find((u) => u.id === point?.studentId);
    if (!user || !point || !student || !canModifyPoint(user, point, student) || !editReason.trim() || !validPointMagnitude(editScore)) {
      setFormError("수정 권한, 사유와 1~5의 정수 점수를 확인해 주세요.");
      return;
    }
    setFormError(null);
    try { updatePoint(
      id,
      { score: type === "상점" ? Math.abs(editScore) : -Math.abs(editScore) },
      user!.id,
      editReason
    ); } catch (cause) { setFormError(cause instanceof Error ? cause.message : "수정하지 못했습니다."); return; }
    setEditingId(null);
  }

  return (
    <div>
      <PageHeader title="상벌점 관리" description="담당 학생의 상점/벌점을 등록하고 관리합니다." />

      <form onSubmit={submit} className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-line bg-paper-raised p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">학생</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass"
          >
            {scopedStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.grade}-{s.classNo}-{s.number})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">구분</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PointType)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass"
          >
            <option value="상점">상점</option>
            <option value="벌점">벌점</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">점수</label>
          <input
            type="number"
            min={1}
            max={5}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">발생일</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-ink">사유</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 학급 활동 적극 참여"
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brass"
          />
        </div>
        <p className="text-sm text-ink-soft">학년도 순상점이 10점 이상이면 인성/봉사 항목에 5점이 자동 반영됩니다.</p>
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-ink"
          >
            <Plus size={15} strokeWidth={2} /> 등록
          </button>
        </div>
        {formError && (
          <p className="sm:col-span-2 lg:col-span-4 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">
            {formError}
          </p>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-paper-raised">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>발생일</th>
              <th>학생</th>
              <th>구분</th>
              <th>점수</th>
              <th>사유</th>
              <th>인증 반영</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td className="text-ink-soft">{p.date}</td>
                <td className="font-medium text-ink">{studentName(p.studentId)}</td>
                <td>
                  <StatusPill label={p.type} />
                </td>
                <td>
                  {editingId === p.id ? (
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={editScore}
                      onChange={(e) => setEditScore(Number(e.target.value))}
                      className="w-16 rounded-md border border-line px-2 py-1 text-sm outline-none focus:border-brass"
                    />
                  ) : (
                    <span className={p.score < 0 ? "text-alert" : "text-certified"}>
                      {p.score > 0 ? `+${p.score}` : p.score}
                    </span>
                  )}
                  {user && users.some((s) => s.id === p.studentId && canModifyPoint(user, p, s)) && <DeletePointButton id={p.id} />}
                </td>
                <td className="text-ink">{p.reason}</td>
                <td className="text-ink-soft">순상점 자동 산정</td>
                <td>
                  {editingId === p.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="수정 사유"
                        className="w-32 rounded-md border border-line px-2 py-1 text-xs outline-none focus:border-brass"
                      />
                      <button
                        onClick={() => saveEdit(p.id, p.type)}
                        className="rounded-md bg-navy px-2 py-1 text-xs text-white"
                      >
                        저장
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={!user || !users.some((s) => s.id === p.studentId && canModifyPoint(user, p, s))}
                      onClick={() => startEdit(p.id, p.score)}
                      className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
                    >
                      <Pencil size={13} strokeWidth={1.75} /> 수정
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-ink-soft">
                  등록된 상벌점 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
