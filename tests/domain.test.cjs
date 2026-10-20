/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS is needed for the isolated TypeScript test loader. */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

// Run pure TypeScript domain modules without adding a test dependency.
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filename);
};
const { computeAreaResults, gradeFromRatio, academicYear, isUnderReview, netPointsForYear } = require("../src/lib/grading.ts");
const { isInTeacherScope, canManageStudent, canReviewSubmission } = require("../src/lib/teacherScope.ts");
const { createDemoAuthService, createBackendAuthService, TOKEN_STORAGE_KEY } = require("../src/lib/auth-service.ts");
const { ApiError } = require("../src/lib/api-client.ts");
const { parseLoginResponse, parseMeResponse } = require("../src/lib/auth-contract.ts");
const { homeForRole, canAccessRole, loginDestination } = require("../src/lib/navigation.ts");
const { softDeletePoint, validPointMagnitude } = require("../src/lib/point-actions.ts");

test("mutation permissions fail closed for unassigned teachers", () => {
  const student = { id: "s", role: "student", grade: 1, classNo: 2 };
  for (const actor of [{ role: "teacher" }, { role: "teacher", homeroom: "2-1" }, student]) {
    assert.equal(canManageStudent(actor, student), false);
    assert.throws(() => softDeletePoint([{ id: "p", studentId: "s" }], "p", actor, [student], "now"));
  }
  assert.equal(canManageStudent({ role: "teacher", homeroom: "1-2" }, student), true);
  assert.equal(canManageStudent({ role: "admin" }, student), true);
});

test("point magnitude honors backend upper bound", () => {
  for (const value of [0, -1, 6, 1.5, NaN, Infinity]) assert.equal(validPointMagnitude(value), false);
  for (const value of [1, 5]) assert.equal(validPointMagnitude(value), true);
});

test("point soft deletion preserves audit data and enforces teacher scope", () => {
  const student = { id: "s", role: "student", grade: 1, classNo: 2 };
  const teacher = { id: "t", role: "teacher", homeroom: "1-2" };
  const points = [{ id: "p", studentId: "s", teacherId: "t", score: -3 }];
  assert.throws(() => softDeletePoint(points, "p", { ...teacher, id: "other" }, [student], "now"));
  const deleted = softDeletePoint(points, "p", teacher, [student], "2026-10-06");
  assert.equal(deleted[0].deletedBy, "t");
  assert.equal(deleted[0].score, -3);
  assert.equal(points[0].deletedAt, undefined);
  assert.equal(deleted.filter((p) => !p.deletedAt).length, 0);
  assert.throws(() => softDeletePoint(deleted, "p", teacher, [student], "now"));
  assert.throws(() => softDeletePoint(points, "p", { ...teacher, homeroom: "2-1" }, [student], "now"));
  assert.throws(() => softDeletePoint(points, "p", student, [student], "now"));
  assert.equal(softDeletePoint(points, "p", { id: "admin", role: "admin" }, [student], "now")[0].deletedBy, "admin");
});

test("role navigation permits admin review but rejects cross-role and unsafe redirects", () => {
  assert.equal(homeForRole("admin"), "/admin/overview");
  assert.equal(canAccessRole("admin", "teacher"), true);
  assert.equal(canAccessRole("teacher", "admin"), false);
  assert.equal(loginDestination("student", "/student/submissions?year=2026"), "/student/submissions?year=2026");
  assert.equal(loginDestination("admin", "/teacher/students"), "/teacher/students");
  assert.equal(loginDestination("teacher", "/profile"), "/profile");
  for (const path of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/studentish/dashboard", "/admin/overview", "/login", "/student/\nfoo", "/student/../admin/overview", "/student/%2e%2e/admin/overview", "/student/%2fadmin"]) {
    assert.equal(loginDestination("student", path), "/student/dashboard");
  }
});

test("admin may inspect students but not non-student records", () => {
  assert.equal(isInTeacherScope({ role: "admin" }, { role: "student" }), true);
  assert.equal(isInTeacherScope({ role: "admin" }, { role: "teacher" }), false);
});

test("demo authentication remains local, asynchronous and password-free to consumers", async () => {
  const values = new Map();
  const service = createDemoAuthService(
    () => [{ id: "student1", name: "Demo", role: "student", password: "1234" }],
    () => ({ getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }),
  );
  assert.equal(await service.restore(), null);
  await assert.rejects(service.login({ username: "student1", password: "wrong" }), { code: "INVALID_CREDENTIAL" });
  const user = await service.login({ username: "student1", password: "1234" });
  assert.equal(user.id, "student1");
  assert.equal("password" in user, false);
  assert.equal((await service.restore()).id, "student1");
  await service.logout();
  assert.equal(await service.restore(), null);
});

test("storage failures never report a successful demo login or logout", async () => {
  const service = createDemoAuthService(
    () => [{ id: "student1", name: "Demo", role: "student", password: "1234" }],
    () => { throw new Error("blocked"); },
  );
  assert.equal(await service.restore(), null);
  await assert.rejects(service.login({ username: "student1", password: "1234" }), { code: "STORAGE_UNAVAILABLE" });
  await assert.rejects(service.logout(), { code: "STORAGE_UNAVAILABLE" });
});

test("backend auth restore preserves token on transient 503 or network error and clears only on 401", async () => {
  const store = new Map([[TOKEN_STORAGE_KEY, "valid-jwt"]]);
  const storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  let nextErr = new ApiError("Temporary outage", 503, "SERVICE_UNAVAILABLE");
  const mockClient = {
    async request() {
      throw nextErr;
    },
  };
  const service = createBackendAuthService(mockClient, () => storage);
  assert.equal(await service.restore(), null);
  assert.equal(store.get(TOKEN_STORAGE_KEY), "valid-jwt");

  nextErr = new TypeError("Failed to fetch");
  assert.equal(await service.restore(), null);
  assert.equal(store.get(TOKEN_STORAGE_KEY), "valid-jwt");

  nextErr = new ApiError("Expired token", 401, "UNAUTHORIZED");
  assert.equal(await service.restore(), null);
  assert.equal(store.has(TOKEN_STORAGE_KEY), false);
});

test("backend auth stores the token on login and clears it on logout even if the server call fails", async () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const sessionUser = { id: "student1", uuid: "u-1", name: "Demo", role: "student", studentId: 7, teacherId: null, grade: 1, classNo: 2, number: 3, homeroom: null };
  const calls = [];
  const mockClient = {
    async request(path, opts) {
      calls.push([path, opts.authenticated]);
      if (path === "/api/auth/login") return { token: "jwt", currentYear: 2026, user: sessionUser };
      throw new ApiError("Network down", 0, "NETWORK_ERROR");
    },
  };
  const service = createBackendAuthService(mockClient, () => storage);
  const user = await service.login({ username: "student1", password: "pw" });
  assert.equal(user.id, "student1");
  assert.equal(store.get(TOKEN_STORAGE_KEY), "jwt");
  assert.deepEqual(calls[0], ["/api/auth/login", false]);
  await service.logout();
  assert.equal(store.has(TOKEN_STORAGE_KEY), false);
});

test("backend auth surfaces login failures as AuthError without storing a token", async () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const mockClient = { async request() { throw new ApiError("Denied", 401, "INVALID_CREDENTIAL"); } };
  const service = createBackendAuthService(mockClient, () => storage);
  await assert.rejects(service.login({ username: "x", password: "y" }), { name: "AuthError", code: "INVALID_CREDENTIAL" });
  assert.equal(store.has(TOKEN_STORAGE_KEY), false);
});

const backendUser = { id: "login-name", uuid: "user-uuid", name: "Demo", role: "student", studentId: 42, teacherId: null, grade: null, classNo: null, number: null, homeroom: null };
test("BE response boundary preserves distinct IDs and normalizes nullable fields", () => {
  const response = { success: true, status_code: 200, data: { token: "token", currentYear: 2026, user: backendUser } };
  const parsed = parseLoginResponse(response);
  assert.equal(parsed.user.id, "login-name");
  assert.equal(parsed.user.studentId, 42);
  assert.equal(parsed.user.grade, undefined);
  assert.equal("password" in parsed.user, false);
  assert.deepEqual(parseMeResponse({ ...response, data: { user: backendUser } }), parsed.user);
});
test("BE boundary rejects unexpected roles, missing tokens and malformed envelopes", () => {
  for (const value of [null, {}, { success: true, status_code: 200, data: {} },
    { success: true, status_code: 200, data: { user: { ...backendUser, role: "root" }, token: "token", currentYear: 2026 } }]) {
    assert.throws(() => parseLoginResponse(value), { code: "INVALID_RESPONSE" });
  }
  assert.throws(() => parseLoginResponse({ success: false, error: { code: "INVALID_CREDENTIAL", message: "Denied" } }), { code: "INVALID_CREDENTIAL" });
});

const area = "전문기술역량";
const criteria = {
  year: 2026, active: true,
  gradeCriteria: [{ grade: 1, areas: [{ area, maxScore: 100, items: [
    { id: "item", active: true, maxScore: 30, scoringType: "최대점제한형" },
  ] }] }],
};
const submission = { studentId: "student", year: 2026, area, itemId: "item", status: "인정완료", score: 20 };
const calculate = (submissions, points = [], rules = criteria) =>
  computeAreaResults("student", 2026, 1, rules, submissions, points)[0].score;

test("item totals cannot exceed the item maximum", () => {
  assert.equal(calculate([submission, submission]), 30);
});
test("highest-only items use the best approved score", () => {
  const rules = structuredClone(criteria);
  rules.gradeCriteria[0].areas[0].items[0].scoringType = "최상위인정형";
  assert.equal(calculate([submission, { ...submission, score: 25 }], [], rules), 25);
});
test("ignore other students, years, pending work and nonfinite scores", () => {
  assert.equal(calculate([
    { ...submission, studentId: "other" }, { ...submission, year: 2025 },
    { ...submission, status: "제출완료" }, { ...submission, score: NaN },
  ]), 0);
});
test("points are isolated by academic year, including legacy records", () => {
  const point = { studentId: "student", reflected: true, reflectedArea: area, score: 5 };
  assert.equal(netPointsForYear("student", 2026, [
    { ...point, date: "2026-02-28" },
    { ...point, date: "2026-03-01" },
    { ...point, date: "2027-02-28" },
    { ...point, date: "2027-03-01" },
    { ...point, date: "2025-01-01", year: 2026 },
  ]), 15);
  assert.equal(academicYear("2027-02-28"), 2026);
});
test("negative totals are clamped to zero", () => {
  assert.equal(calculate([], [{ studentId: "student", year: 2026, reflected: true, reflectedArea: area, score: -5 }]), 0);
});
test("grade boundaries and initial submissions awaiting review", () => {
  assert.deepEqual([0.9, 0.8, 0.7, 0.69].map(gradeFromRatio), ["S", "A", "B", "미달성"]);
  assert.equal(isUnderReview({ status: "제출완료" }), true);
  assert.equal(isUnderReview({ status: "인정완료" }), false);
});
test("teacher scope accepts both documented formats and rejects other classes", () => {
  const student = { role: "student", grade: 1, classNo: 2 };
  for (const homeroom of ["1-2", "1학년 2반"]) {
    assert.equal(isInTeacherScope({ role: "teacher", homeroom }, student), true);
  }
  assert.equal(isInTeacherScope({ role: "teacher", homeroom: "1-3" }, student), false);
  assert.equal(isInTeacherScope({ role: "student" }, student), false);
});

test("inactive criteria preserve approved scores", () => {
  const rules = structuredClone(criteria);
  rules.gradeCriteria[0].areas[0].items[0].active = false;
  assert.equal(calculate([submission], [], rules), 20);
});

test("assigned evaluator permissions are submission specific", () => {
  const student = { id: "student", role: "student", grade: 1, classNo: 1 };
  const teacher = { role: "teacher", teacherDuty: "dedicated_evaluator", teacherScope: { itemIds: ["item"] } };
  assert.equal(canManageStudent(teacher, student), false);
  assert.equal(canReviewSubmission(teacher, student, submission, true), true);
  assert.equal(canReviewSubmission(teacher, student, { ...submission, itemId: "other" }), false);
  assert.equal(canReviewSubmission({ ...teacher, teacherDuty: "subject_teacher" }, student, submission, true), false);
});

test("automatic net-point award respects threshold year and deletion", () => {
  const rules = { year: 2026, gradeCriteria: [{ grade: 1, areas: [{ area: "인성/봉사", maxScore: 20, items: [{ id: "item-405", active: true, autoCalculated: true, maxScore: 5, scoringType: "고정점수형" }] }] }] };
  const point = { studentId: "student", year: 2026, type: "상점", score: 10 };
  assert.equal(calculate([], [point], rules), 5);
  const copied = structuredClone(rules);
  copied.gradeCriteria[0].areas[0].items[0].id = "item-405-2027";
  assert.equal(calculate([], [point], copied), 5);
  assert.equal(calculate([], [{ ...point, score: 9 }], rules), 0);
  assert.equal(calculate([], [{ ...point, deletedAt: "now" }], rules), 0);
  assert.equal(calculate([], [{ ...point, year: 2025 }], rules), 0);
  assert.equal(calculate([], [point, { ...point, type: "벌점", score: -1 }], rules), 0);
});
