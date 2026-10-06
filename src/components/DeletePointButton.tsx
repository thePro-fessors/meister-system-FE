"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";

export function DeletePointButton({ id }: { id: string }) {
  const { user } = useAuth();
  const { deletePoint } = useData();
  const [error, setError] = useState("");
  return <span className="ml-3">
    <button className="text-xs text-alert hover:underline" onClick={() => {
      if (!user || !window.confirm("이 상벌점 기록을 삭제하시겠습니까? 합계와 인증 점수가 다시 계산되며 삭제 이력은 보존됩니다.")) return;
      try { deletePoint(id, user.id); } catch (cause) { setError(cause instanceof Error ? cause.message : "삭제에 실패했습니다."); }
    }}>삭제</button>
    {error && <span role="alert" className="block text-xs text-alert">{error}</span>}
  </span>;
}
