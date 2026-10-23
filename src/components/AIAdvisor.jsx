import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./AIAdvisor.css";
import { API_BASE } from "../apiConfig";

function AIAdvisor() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! 👋 Welcome to SpendWise AI!\n\nI'm here to help with your finances, studies, coding, career, general questions, or anything else I can assist with.\n\n**What would you like to talk about today?** ✨",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [includeFinancialData, setIncludeFinancialData] = useState(false);

  // Send the user's question to the backend.
  const sendMessage = async (event) => {
    event.preventDefault();

    const question = input.trim();
    const shareFinancialData = includeFinancialData;

    if (!question || loading) return;

    setInput("");
    setIncludeFinancialData(false);
    setChatError("");

    setMessages((previousMessages) => [
      ...previousMessages,
      {
        role: "user",
        text: question,
        financialContextShared: shareFinancialData,
      },
    ]);

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/advisor`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: question,
            history: messages
              .filter((item) => shareFinancialData || !item.financialContextShared)
              .slice(-6)
              .map(({ role, text }) => ({
                role,
                text: text.slice(-1000),
              })),
            includeFinancialData: shareFinancialData,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event("spendwise:session-expired"));
        }
        throw new Error(
          data.error || "The AI could not respond. Please try again."
        );
      }

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          text:
            data.reply ||
            "Sorry, I couldn't generate a response. Please try again.",
          financialContextShared: shareFinancialData,
        },
      ]);
    } catch (error) {
      setMessages((previousMessages) => previousMessages.slice(0, -1));
      setInput(question);
      setChatError(
        error instanceof TypeError
          ? "Can't connect to the SpendWise server. Check that the backend is running, then try again."
          : error.message || "Unable to connect to SpendWise AI. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Clicking a suggestion fills the message input.
  const suggestedQuestions = [
    "How can I save more money?",
    "Explain artificial intelligence simply.",
    "Help me prepare for placements.",
    "Where am I spending the most?",
  ];

  return (
    <div className="advisor-page">
      {/* Chatbot header */}
      <header className="advisor-header">
        <div>
          <span className="advisor-eyebrow">
            YOUR FRIENDLY AI ASSISTANT
          </span>

          <h1>SpendWise AI ✨</h1>

          <p>
            Your little helper for money, learning, career, and everyday
            questions.
          </p>
        </div>

        <div className="advisor-header-icon" aria-hidden="true">
          💗
        </div>
      </header>

      {/* Main chatbot */}
      <section className="advisor-chat">
        <div className="advisor-chat-header">
          <div className="advisor-chat-avatar" aria-hidden="true">
            🤖
          </div>

          <div>
            <h2>Chat with SpendWise AI</h2>

            <p>
              <span className="advisor-status-dot" />
              Your AI assistant
            </p>
          </div>
        </div>

        {/* Conversation */}
        <div
          className="advisor-chat-messages"
          aria-live="polite"
          aria-label="Chat conversation"
        >
          {messages.map((message, index) => (
            <div
              className={`advisor-message advisor-message-${message.role}`}
              key={`${message.role}-${index}`}
            >
              {message.role === "assistant" && (
                <span
                  className="advisor-message-avatar"
                  aria-hidden="true"
                >
                  ✨
                </span>
              )}

              <div className="advisor-message-bubble">
                {message.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : (
                  message.text
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="advisor-message advisor-message-assistant">
              <span
                className="advisor-message-avatar"
                aria-hidden="true"
              >
                ✨
              </span>

              <div
                className="advisor-message-bubble advisor-typing"
                role="status"
              >
                Thinking of a helpful answer...
              </div>
            </div>
          )}
        </div>

        {/* Suggested questions */}
        <div className="advisor-suggestions">
          <p className="advisor-suggestions-label">
            Need an idea? Try asking:
          </p>

          {suggestedQuestions.map((question) => (
            <button
              type="button"
              key={question}
              disabled={loading}
              onClick={() => setInput(question)}
            >
              {question}
            </button>
          ))}
        </div>

        {/* Error message */}
        {chatError && (
          <div className="advisor-chat-error" role="alert">
            {chatError}
          </div>
        )}

        {/* Message input */}
        <label className="advisor-data-toggle">
          <input
            type="checkbox"
            checked={includeFinancialData}
            onChange={(event) => setIncludeFinancialData(event.target.checked)}
            disabled={loading}
          />
          <span>
            <strong>Use my SpendWise data for this question</strong>
            <small>
              When enabled, your financial summary and recent chat context are
              sent to the AI provider for this question. Replies based on your
              records are left out of later requests when sharing is off.
            </small>
          </span>
        </label>
        <form
          className="advisor-chat-form"
          onSubmit={sendMessage}
        >
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask me anything..."
            aria-label="Message SpendWise AI"
            maxLength={2000}
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            {loading ? "..." : "Send ↗"}
          </button>
        </form>

        <p className="advisor-chat-disclaimer">
          AI can make mistakes. Verify important information before
          making financial, academic, or other important decisions.
        </p>
      </section>
    </div>
  );
}

export default AIAdvisor;
