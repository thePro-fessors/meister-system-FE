"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";

export function DeletePointButton({ id }: { id: string }) {
  const { user } = useAuth();
  const { deletePoint } = useData();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="ml-3 inline-flex items-center gap-1.5">
      {!confirming ? (
        <button
          type="button"
          className="text-xs text-alert hover:underline"
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
        >
          삭제
        </button>
      ) : (
        <>
          <button
            type="button"
            className="rounded bg-alert px-2 py-0.5 text-xs font-semibold text-white hover:opacity-90"
            onClick={() => {
              if (!user) return;
              try {
                deletePoint(id, user.id);
                setConfirming(false);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "삭제에 실패했습니다.");
                setConfirming(false);
              }
            }}
          >
            삭제 확인
          </button>
          <button
            type="button"
            className="rounded border border-line px-2 py-0.5 text-xs text-ink-soft hover:bg-paper-raised"
            onClick={() => setConfirming(false)}
          >
            취소
          </button>
        </>
      )}
      {error && <span role="alert" className="block text-xs text-alert">{error}</span>}
    </span>
  );
}
