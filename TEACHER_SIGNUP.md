# Teacher signup (local demo)

Set `TEACHER_SIGNUP_CODE` in the Next.js server environment (for local development,
in `.env.local`), then restart the server. Use a long, randomly generated code and
share it with teachers privately. Never use a `NEXT_PUBLIC_` variable for this code.

On `/signup`, select the teacher role and enter the administrator-provided code.
The server checks the code; the resulting demo account is stored only in this
browser. No classroom or privileged scope is assigned automatically. This does
not register an account in the FastAPI backend or grant production authorization.

The verification endpoint has a process-local attempt limiter. A deployment
proxy must overwrite `X-Forwarded-For` and prevent direct access to the Next.js
server. Production registration requires backend account creation and a shared
rate limiter using a trusted client identity.

Student selection in teacher point management supports name, account ID,
hyphenated class/number, and five-digit student-number searches. Select a result
with a click or the arrow keys and Enter; Escape closes the results.
