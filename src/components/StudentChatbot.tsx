"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { computeAreaResults, computeCertStatus } from "@/lib/grading";
import { answerStudentQuestion, DEFAULT_SUGGESTIONS } from "@/lib/chatbot";
import { apiClient } from "@/lib/api-client";

interface Message {
  id: string;
  role: "bot" | "user";
  text: string;
  suggestions?: string[];
}

export function StudentChatbot() {
  const { user } = useAuth();
  const { criteria, submissions, points } = useData();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const year = criteria.find((c) => c.active) ?? criteria[0];

  const results = useMemo(
    () => (user?.grade && year ? computeAreaResults(user.id, year.year, user.grade, year, submissions, points) : []),
    [user, year, submissions, points]
  );

  const mySubmissions = useMemo(
    () => submissions.filter((s) => s.studentId === user?.id && s.year === year?.year),
    [submissions, user, year]
  );
  const myPoints = useMemo(() => points.filter((p) => p.studentId === user?.id), [points, user]);

  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const hasUnderReview = mySubmissions.some((s) => ["제출완료", "검토중", "재제출요청"].includes(s.status));
  const certStatus = computeCertStatus(results, hasUnderReview);

  function toggleChat() {
    if (!open && messages.length === 0 && user) {
      setMessages([
        {
          id: "welcome",
          role: "bot",
          text: `안녕하세요, ${user.name}님! 저는 마이스터역량인증제 AI 도우미예요. 인증 현황, 제출 방법, 상벌점 등 무엇이든 편하게 물어보세요.`,
          suggestions: DEFAULT_SUGGESTIONS,
        },
      ]);
    }
    setOpen((value) => !value);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  async function send(text: string) {
    if (!text.trim() || !user || !year || loading) return;
    idRef.current += 1;
    const userMsg: Message = { id: `u-${idRef.current}`, role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await apiClient.request<{
        reply?: string;
        message?: string;
        conversationId?: string;
        suggestions?: string[];
      }>("/api/ai/student/chat", {
        method: "POST",
        body: {
          message: text,
          conversationId,
        },
      });

      if (res?.conversationId) setConversationId(res.conversationId);
      const botReply = res?.reply || res?.message || "답변을 불러오지 못했습니다.";
      idRef.current += 1;
      const botMsg: Message = {
        id: `b-${idRef.current}`,
        role: "bot",
        text: botReply,
        suggestions: res?.suggestions && res.suggestions.length > 0 ? res.suggestions : DEFAULT_SUGGESTIONS,
      };
      setMessages((m) => [...m, botMsg]);
    } catch {
      // Fallback to local rule engine if offline or server AI fails
      const fallbackReply = answerStudentQuestion(text, {
        student: user,
        year: year.year,
        results,
        certStatus,
        totalScore,
        submissions: mySubmissions,
        points: myPoints,
      });
      idRef.current += 1;
      const botMsg: Message = {
        id: `b-${idRef.current}`,
        role: "bot",
        text: fallbackReply.text,
        suggestions: fallbackReply.suggestions,
      };
      setMessages((m) => [...m, botMsg]);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-3rem)]">
      {open && (
        <div className="chatbot-panel pointer-events-auto mb-3 flex h-112 max-h-[calc(100dvh-7rem)] w-full flex-col overflow-hidden rounded-lg border border-line bg-paper-raised shadow-xl">
          <div className="flex items-center justify-between border-b border-line bg-navy px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <Sparkles size={16} strokeWidth={1.75} />
              <p className="font-display text-sm font-semibold">AI 학생 도우미</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-navy text-white" : "bg-navy-soft text-ink"
                  }`}
                >
                  {m.text}
                </div>
                {m.role === "bot" && m.suggestions && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-full border border-brass/50 bg-brass-soft/50 px-2.5 py-1 text-xs text-ink hover:bg-brass-soft"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-start">
                <div className="max-w-[85%] rounded-lg bg-navy-soft px-3 py-2 text-xs text-ink-soft animate-pulse">
                  AI가 분석하고 있습니다...
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-line px-3 py-3"
          >
            <input
              aria-label="도우미에게 질문"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="궁금한 점을 물어보세요"
              className="flex-1 rounded-full border border-line px-3 py-2 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
            />
            <button
              type="submit"
              aria-label="질문 보내기"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white hover:bg-ink"
            >
              <Send size={15} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={toggleChat}
        aria-expanded={open}
        className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-brass text-white shadow-lg transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: open ? "translateX(0)" : "translateX(calc(min(20rem, 100vw - 3rem) - 3.5rem))" }}
        aria-label={open ? "AI 학생 도우미 닫기" : "AI 학생 도우미 열기"}
      >
        <MessageCircle
          aria-hidden="true"
          size={22}
          strokeWidth={1.75}
          className={`absolute transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "scale-75 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}
        />
        <X
          aria-hidden="true"
          size={22}
          strokeWidth={1.75}
          className={`absolute transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "scale-100 rotate-0 opacity-100" : "scale-75 rotate-90 opacity-0"}`}
        />
      </button>
    </div>
  );
}
