"use client";

import { useEffect, useId, useState } from "react";
import type { User } from "@/lib/types";

export default function StudentCombobox({ students, value, onChange }: { students: User[]; value: string; onChange: (id: string) => void }) {
  const id = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  const label = (student: User) => `${student.name} (${student.grade}-${student.classNo}-${student.number})`;
  const selected = students.find((student) => student.id === value);
  const matches = students.filter((student) => `${label(student)} ${student.id} ${student.grade}${String(student.classNo).padStart(2, "0")}${String(student.number).padStart(2, "0")}`.toLowerCase().includes((query ?? "").trim().toLowerCase()));
  function choose(student: User) {
    onChange(student.id);
    setQuery(null);
    setOpen(false);
    setActive(-1);
  }
  return <div className="relative" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
  }}>
    <input aria-label="학생 이름 또는 학번 검색" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 && matches[active] ? `${id}-${active}` : undefined}
      autoComplete="off" required placeholder="이름 또는 학번 검색" value={query ?? (selected ? label(selected) : "")}
      className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brass"
      onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); onChange(""); setOpen(true); setActive(-1); }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive((index) => matches.length ? (event.key === "ArrowDown" ? Math.min(index + 1, matches.length - 1) : Math.max(index - 1, 0)) : -1);
        } else if (event.key === "Enter" && open) {
          event.preventDefault(); if (matches[active]) choose(matches[active]);
        } else if (event.key === "Escape") { setOpen(false); setActive(-1); }
      }} />
    {open && <ul id={`${id}-list`} role="listbox" aria-label="학생 검색 결과" className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-white p-1 shadow-lg">
      {matches.map((student, index) => <li key={student.id} id={`${id}-${index}`} role="option" aria-selected={student.id === value}
        className={`cursor-pointer rounded px-3 py-2 text-sm ${active === index ? "bg-brass-soft" : "hover:bg-brass-soft"}`}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(student)}>{label(student)}</li>)}
      {!matches.length && <li role="presentation" className="px-3 py-2 text-sm text-ink-soft">일치하는 학생이 없습니다.</li>}
    </ul>}
  </div>;
}
