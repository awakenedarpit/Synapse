"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Message = { role: "user" | "assistant"; content: string; memoryId?: string };
type ChatSession = { id: string; title: string; createdAt: number; updatedAt: number; messages: Message[] };
type Theme = "dark" | "light";
type UploadPreview = { name: string; kind: string; size: number; text: string; headings: string[]; tables: { title: string; rows: string[][] }[]; references: string[]; truncated: boolean };

const acceptedFiles = ".pdf,.docx,.pptx,.txt,.md,.csv,.jpg,.jpeg,.png,.webp";
const maxUploadFiles = 5;
const maxUploadFileBytes = 10 * 1024 * 1024;

const starterPrompts = [
  { icon: "✦", label: "Remember a fact", text: "Remember that my hackathon project uses FalkorDB." },
  { icon: "⌕", label: "Recall context", text: "What do you remember about my project?" },
  { icon: "◌", label: "Explore a connection", text: "Connect the people and tools I have mentioned." },
];

const welcomeMessage: Message = { role: "assistant", content: "Hello — I’m your Synapse Agent. I can remember the useful details behind your work, connect the dots, and bring them back when you need them." };

function createChat(): ChatSession {
  const now = Date.now();
  return { id: `chat-${now}-${Math.random().toString(36).slice(2, 7)}`, title: "New memory chat", createdAt: now, updatedAt: now, messages: [welcomeMessage] };
}

function formatChatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderInlineMarkdown(text: string) {
  const normalized = text.replace(/\\([\\\`*_{}\[\]()#+.!>|~-])/g, "$1");
  const tokens = normalized.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\`[^\`]+\`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g).filter(Boolean);
  return tokens.map((token, index) => {
    if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) return <em key={index}>{token.slice(1, -1)}</em>;
    if (token.startsWith("\`") && token.endsWith("\`")) return <code className="markdown-inline-code" key={index}>{token.slice(1, -1)}</code>;
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer noopener">{link[1]}</a>;
    return <span key={index}>{token}</span>;
  });
}

function renderMarkdown(content: string) {
  const normalized = content.replace(/\r\n?/g, "\n").replace(/\\([\\\`*_{}\[\]()#+.!>|~-])/g, "$1").trim();
  if (!normalized) return null;
  const lines = normalized.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let codeLines: string[] | null = null;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={blocks.length}>{paragraph.map((line, index) => <span key={index}>{index > 0 ? " " : ""}{renderInlineMarkdown(line.trim())}</span>)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (!listType || !listItems.length) { listItems = []; listType = null; return; }
    const items = listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>);
    blocks.push(listType === "ol" ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    listItems = []; listType = null;
  };
  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (line.startsWith("\`\`\`")) {
      flushParagraph(); flushList();
      if (codeLines) { blocks.push(<pre className="markdown-code-block" key={blocks.length}><code>{codeLines.join("\n")}</code></pre>); codeLines = null; }
      else codeLines = [];
      return;
    }
    if (codeLines) { codeLines.push(rawLine); return; }
    if (!line) { flushParagraph(); flushList(); return; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length, children = renderInlineMarkdown(heading[2]);
      if (level === 1) blocks.push(<h3 key={blocks.length}>{children}</h3>);
      else if (level === 2) blocks.push(<h4 key={blocks.length}>{children}</h4>);
      else blocks.push(<h5 key={blocks.length}>{children}</h5>);
      return;
    }
    if (/^([-*_])\1\1+\s*$/.test(line)) { flushParagraph(); flushList(); blocks.push(<hr key={blocks.length} />); return; }
    const unordered = line.match(/^[-*+]\s+(.+)$/), ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph(); const nextType = unordered ? "ul" : "ol";
      if (listType && listType !== nextType) flushList();
      listType = nextType; listItems.push((unordered || ordered)![1]); return;
    }
    flushList(); paragraph.push(rawLine);
  });
  flushParagraph(); flushList();
  const remainingCode: string[] | null = codeLines as string[] | null;
  if (remainingCode) blocks.push(<pre className="markdown-code-block" key={blocks.length}><code>{remainingCode.join("\n")}</code></pre>);
  return <div className="markdown-content">{blocks}</div>;
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [extractionPreviews, setExtractionPreviews] = useState<UploadPreview[]>([]);
  const [attachmentToken, setAttachmentToken] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");

  const activeChat = sessions.find((session) => session.id === activeId) || sessions[0];
  const visibleSessions = useMemo(() => sessions.filter((session) => session.title.toLowerCase().includes(chatSearch.toLowerCase())), [sessions, chatSearch]);

  useEffect(() => {
    const storedChats = window.localStorage.getItem("graph-memory-chats");
    const initial = storedChats ? JSON.parse(storedChats) as ChatSession[] : [createChat()];
    setSessions(initial.length ? initial : [createChat()]);
    setActiveId(initial[0]?.id || "");
    const storedTheme = window.localStorage.getItem("graph-memory-theme") as Theme | null;
    const nextTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("graph-memory-chats", JSON.stringify(sessions));
  }, [sessions, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("graph-memory-theme", theme);
  }, [theme, mounted]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeChat?.messages.length, loading]);

  function updateActiveChat(updater: (chat: ChatSession) => ChatSession) {
    setSessions((previous) => previous.map((chat) => chat.id === activeChat?.id ? updater(chat) : chat));
  }

  function startNewChat() {
    const next = createChat();
    setSessions((previous) => [next, ...previous]);
    setActiveId(next.id);
    setInput("");
    setSidebarOpen(false);
  }

  function selectChat(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
  }

  async function previewFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length) return;
    if (files.length > maxUploadFiles) { setUploadError(`Choose no more than ${maxUploadFiles} files at a time.`); return; }
    if (files.some((file) => file.size > maxUploadFileBytes)) { setUploadError("Each file must be 10 MB or smaller."); return; }
    if (files.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) { setUploadError("The combined upload size must be 20 MB or smaller."); return; }
    setAttachedFiles(files);
    setExtractionPreviews([]);
    setAttachmentToken("");
    setUploadError("");
    setUploading(true);
    setUploadStatus("Validating files and extracting content…");
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The selected files could not be extracted.");
      setExtractionPreviews(Array.isArray(data.files) ? data.files as UploadPreview[] : []);
      setAttachmentToken(typeof data.token === "string" ? data.token : "");
      setUploadStatus(`${files.length} ${files.length === 1 ? "file" : "files"} extracted. Review the preview before sending.`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The selected files could not be extracted.");
      setUploadStatus("");
    } finally {
      setUploading(false);
    }
  }

  function removeFile(index: number) {
    setAttachedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setExtractionPreviews((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setAttachmentToken("");
    setUploadError("");
    setUploadStatus(attachedFiles.length <= 1 ? "" : "File removed. Re-select the remaining files to refresh their secure preview.");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    const filesReady = attachedFiles.length > 0 && extractionPreviews.length === attachedFiles.length && Boolean(attachmentToken) && !uploadError;
    if ((!text && !filesReady) || loading || uploading || !activeChat) return;
    const userText = text || "Please summarize the attached files.";
    const displayedUserText = attachedFiles.length ? `${userText}\n\nAttachments: ${attachedFiles.map((file) => file.name).join(", ")}` : userText;
    const conversation = activeChat.messages.slice(-8).map(({ role, content, memoryId }) => ({ role, content, ...(memoryId ? { memoryId } : {}) }));
    updateActiveChat((chat) => ({ ...chat, title: chat.title === "New memory chat" ? userText.slice(0, 48) : chat.title, updatedAt: Date.now(), messages: [...chat.messages, { role: "user", content: displayedUserText }] }));
    setInput("");
    setLoading(true);
    try {
      let response: Response;
      if (attachedFiles.length) {
        const formData = new FormData();
        formData.set("message", text);
        formData.set("conversation", JSON.stringify(conversation));
        formData.set("attachmentToken", attachmentToken);
        response = await fetch("/api/chat", { method: "POST", body: formData });
      } else {
        response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, conversation }) });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The AI request failed.");
      updateActiveChat((chat) => ({ ...chat, updatedAt: Date.now(), messages: chat.messages.map((item, index) => index === chat.messages.length - 1 && item.role === "user" && typeof data.memoryId === "string" ? { ...item, memoryId: data.memoryId } : item).concat({ role: "assistant", content: data.reply || "Gemini returned an empty response." }) }));
      setAttachedFiles([]);
      setExtractionPreviews([]);
      setAttachmentToken("");
      setUploadStatus("");
    } catch (error) {
      updateActiveChat((chat) => ({ ...chat, updatedAt: Date.now(), messages: [...chat.messages, { role: "assistant", content: error instanceof Error ? `I couldn’t reach the memory service: ${error.message}` : "I couldn’t reach the memory service. Please try again." }] }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className={`mobile-scrim ${sidebarOpen ? "is-visible" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      <aside className={`workspace-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-topline"><Link href="/" className="brand" aria-label="Synapse home"><span className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="synapse-stroke" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#8BE9E1"/><stop offset=".52" stopColor="#9A91FF"/><stop offset="1" stopColor="#6E9CFF"/></linearGradient></defs><path d="M10 8.5 16 5l6 3.5v7L16 19l-6-3.5v-7Z" stroke="url(#synapse-stroke)" strokeWidth="1.8" strokeLinejoin="round"/><path d="m10 15.5-4 2.3v6.1l5.3 3.1 5.3-3.1v-4.8M22 15.5l4 2.3v6.1l-5.3 3.1-4.1-2.4" stroke="url(#synapse-stroke)" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="16" cy="12" r="2.2" fill="#F5F7FF"/><circle cx="6" cy="17.8" r="1.7" fill="#8BE9E1"/><circle cx="26" cy="17.8" r="1.7" fill="#9A91FF"/><circle cx="16" cy="24.9" r="1.7" fill="#7FAEFF"/></svg></span><span><strong>Synapse</strong><small>Personal knowledge workspace</small></span></Link><button type="button" className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">×</button></div>
        <button type="button" className="new-chat-button" onClick={startNewChat}><span className="new-chat-plus">＋</span> New chat <kbd>⌘ K</kbd></button>
        <nav className="workspace-nav" aria-label="Workspace navigation"><p className="nav-label">Workspace</p><Link href="/" className="workspace-link workspace-link-active"><span className="nav-icon">✦</span><span>Memory chat</span><span className="nav-arrow">⌘ 1</span></Link><Link href="/graph" className="workspace-link"><span className="nav-icon">◌</span><span>Graph explorer</span><span className="nav-arrow">⌘ 2</span></Link></nav>
        <div className="chat-history"><div className="history-heading"><p className="nav-label">Your chats</p><button type="button" className="icon-button small" aria-label="Search chats" onClick={() => document.getElementById("chat-search")?.focus()}>⌕</button></div><div className="search-field"><span>⌕</span><input id="chat-search" value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Search chats" aria-label="Search chats" /></div><div className="history-list">{visibleSessions.length ? visibleSessions.map((session) => <button key={session.id} type="button" className={`history-item ${activeChat?.id === session.id ? "history-item-active" : ""}`} onClick={() => selectChat(session.id)}><span className="history-item-title">{session.title}</span><span className="history-item-date">{formatChatDate(session.updatedAt)}</span></button>) : <p className="empty-history">No chats found</p>}</div></div>
        <div className="sidebar-footer"><div className="plan-card"><div className="plan-card-icon">✦</div><div><strong>Memory is growing</strong><p>Connect more facts to make recall richer.</p></div></div><div className="footer-row"><div className="profile-button"><span className="profile-avatar">S</span><span className="profile-copy"><strong>Demo workspace</strong><small>Shared prototype</small></span></div><button type="button" className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? "☼" : "◐"}</button></div></div>
      </aside>

      <section className="main-workspace">
        <header className="topbar"><div className="topbar-left"><button type="button" className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">☰</button><div className="mobile-page-title"><span className="status-dot" /> Synapse</div><div className="model-picker"><span className="model-orb" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="synapse-model-stroke" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#8BE9E1"/><stop offset=".52" stopColor="#9A91FF"/><stop offset="1" stopColor="#6E9CFF"/></linearGradient></defs><path d="M10 8.5 16 5l6 3.5v7L16 19l-6-3.5v-7Z" stroke="url(#synapse-model-stroke)" strokeWidth="1.8" strokeLinejoin="round"/><path d="m10 15.5-4 2.3v6.1l5.3 3.1 5.3-3.1v-4.8M22 15.5l4 2.3v6.1l-5.3 3.1-5.3-3.1v-4.8" stroke="url(#synapse-model-stroke)" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="16" cy="12" r="2.2" fill="#F5F7FF"/><circle cx="6" cy="17.8" r="1.7" fill="#8BE9E1"/><circle cx="26" cy="17.8" r="1.7" fill="#9A91FF"/><circle cx="16" cy="24.9" r="1.7" fill="#7FAEFF"/></svg></span><span><strong>Synapse</strong><small>Automatic context</small></span><span className="chevron">⌄</span></div></div><div className="topbar-actions"><span className="connection-status"><i /> <span>FalkorDB connected</span></span><button type="button" className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme">{theme === "dark" ? "☼" : "◐"}</button><button type="button" className="share-button" onClick={() => navigator.clipboard?.writeText(window.location.href)}><span>↗</span> Share</button><span className="top-avatar" aria-label="Demo workspace">S</span></div></header>
        <div className="chat-viewport"><div className="chat-column">
          <div className="chat-heading"><div className="heading-kicker"><span className="sparkle">✦</span> Your private knowledge layer</div><h1>{activeChat?.title === "New memory chat" ? "What would you like to remember?" : activeChat?.title}</h1><p>Store the details behind your work, then ask questions that span people, projects, and relationships.</p></div>
          <div className="message-list" aria-live="polite" aria-label="Conversation">{activeChat?.messages.map((message, index) => <div key={`${activeChat.id}-${message.role}-${index}`} className={`message-row ${message.role === "user" ? "message-row-user" : ""}`}><div className={`message-avatar ${message.role === "user" ? "user-avatar" : "agent-avatar"}`}>{message.role === "user" ? "A" : "✦"}</div><div className="message-content"><div className="message-meta"><strong>{message.role === "user" ? "You" : "Synapse"}</strong><span>{message.role === "user" ? "Just now" : "Agent response"}</span></div><div className={`message-text ${message.role === "user" ? "message-text-user" : ""}`}>{message.role === "assistant" ? renderMarkdown(message.content) : message.content}</div></div></div>)}{loading && <div className="message-row" role="status"><div className="message-avatar agent-avatar">✦</div><div className="message-content"><div className="message-meta"><strong>Synapse</strong><span>Thinking</span></div><div className="loading-line"><span /><span /><span /></div></div></div>}<div ref={endRef} /></div>
          {activeChat?.messages.length === 1 && <div className="starter-grid">{starterPrompts.map((prompt) => <button key={prompt.text} type="button" className="starter-card" onClick={() => setInput(prompt.text)}><span className="starter-icon">{prompt.icon}</span><span><strong>{prompt.label}</strong><small>{prompt.text}</small></span><span className="starter-arrow">↗</span></button>)}</div>}
          <form onSubmit={sendMessage} className="composer-wrap">
            {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}
            {uploadStatus && <p className="upload-status" role="status">{uploading && <span className="upload-spinner" aria-hidden="true" />} {uploadStatus}</p>}
            {attachedFiles.length > 0 && <div className="attachment-list" aria-label="Attached files">
              {attachedFiles.map((file, index) => {
                const preview = extractionPreviews[index];
                return <article className="attachment-card" key={`${file.name}-${file.lastModified}-${index}`}>
                  <div className="attachment-topline"><span className="attachment-file-icon" aria-hidden="true">▤</span><div className="attachment-file-copy"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(file.size < 1024 * 1024 ? 2 : 1)} MB{preview ? ` · ${preview.kind.toUpperCase()}` : " · Processing"}</small></div><button type="button" className="attachment-remove" disabled={loading || uploading} onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>×</button></div>
                  {preview ? <details className="extraction-preview"><summary>Extraction preview{preview.truncated ? " (truncated)" : ""}</summary>
                    {preview.headings.length > 0 && <p><strong>Headings:</strong> {preview.headings.slice(0, 8).join(" · ")}</p>}
                    {preview.references.length > 0 && <p><strong>References:</strong> {preview.references.slice(0, 12).join(", ")}</p>}
                    {preview.tables.map((table, tableIndex) => <div className="preview-table" key={`${table.title}-${tableIndex}`}><strong>{table.title}</strong>{table.rows.slice(0, 5).map((row, rowIndex) => <div key={rowIndex}>{row.join(" | ")}</div>)}</div>)}
                    <pre>{preview.text.slice(0, 3000)}{preview.text.length > 3000 ? "…" : ""}</pre>
                  </details> : <p className="attachment-wait">{uploading ? "Checking file signature and extracting content…" : "Preview unavailable."}</p>}
                </article>;
              })}
            </div>}
            <div className="premium-composer">
              <div className="composer-tools"><input ref={uploadInputRef} className="upload-input" type="file" accept={acceptedFiles} multiple onChange={previewFiles} aria-label="Choose files to attach" /><button type="button" className="composer-icon" aria-label="Attach documents or images" title="Attach PDF, DOCX, PPTX, TXT, Markdown, CSV, JPG, PNG, or WEBP" disabled={loading || uploading} onClick={() => uploadInputRef.current?.click()}>＋</button></div>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Message your memory agent…" rows={1} disabled={loading || uploading} aria-label="Message your memory agent" />
              <div className="composer-actions"><span className="composer-hint">{loading ? "Working…" : uploading ? "Extracting…" : "↵ to send"}</span><button type="submit" className="send-button" disabled={loading || uploading || Boolean(uploadError) || (!input.trim() && !(attachedFiles.length > 0 && extractionPreviews.length === attachedFiles.length && Boolean(attachmentToken)))} aria-label="Send message">↑</button></div>
            </div>
            <p className="composer-disclaimer">Files are processed in memory; extracted content is saved as a memory when sent. Synapse can make mistakes—check important information against your source graph.</p>
          </form>
        </div></div>
      </section>

    </main>
  );
}
