/**
 * Route: `/assistant` — coastal Q&A via ReefPulse API.
 */
import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { postChatQuery } from "../../api/chatAssistant";
import "../explore/workflow.css";
import "./assistant.css";

export default function ReefAssistantPage() {
  const [input, setInput] = useState("");
  const [rows, setRows] = useState(() => [
    {
      role: "assistant",
      text: "Ask about California beaches, snorkeling conditions at a high level, or marine life IDs — not a substitute for lifeguards or official forecasts.",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  async function onSend(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setRows((r) => [...r, { role: "user", text: q }]);
    setBusy(true);
    try {
      const { reply, model } = await postChatQuery(q);
      setRows((r) => [...r, { role: "assistant", text: reply, model }]);
      requestAnimationFrame(scrollDown);
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : "Request failed";
      setRows((r) => [
        ...r,
        {
          role: "assistant",
          text: `Could not get a reply: ${msg}`,
          isError: true,
        },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(scrollDown);
    }
  }

  return (
    <div className="wf-page rp-assistant">
      <nav className="rp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <span aria-current="page">Assistant</span>
      </nav>

      <header className="rp-assistant-hero">
        <h1>ReefPulse Assistant</h1>
        <p>
          Quick answers on California beaches, snorkeling at a high level, and marine life IDs — not a substitute for
          lifeguards or official forecasts.
        </p>
      </header>

      <div
        className="rp-assistant-chat"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {rows.map((row, i) => (
          <div
            key={i}
            className={`rp-assistant-row rp-assistant-row--${row.role}${row.isError ? " rp-assistant-row--err" : ""}`}
          >
            <span className="rp-assistant-role">
              {row.role === "user" ? "You" : "Assistant"}
            </span>
            <div className="rp-assistant-bubble">{row.text}</div>
            {row.model ? (
              <span className="rp-assistant-model">{row.model}</span>
            ) : null}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="rp-assistant-form" onSubmit={onSend}>
        <label className="visually-hidden" htmlFor="assistant-input">
          Message
        </label>
        <textarea
          id="assistant-input"
          className="rp-assistant-input"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What should I check before snorkeling at La Jolla Shores?"
          disabled={busy}
        />
        <button
          type="submit"
          className="rp-assistant-send"
          disabled={busy || !input.trim()}
        >
          {busy ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
