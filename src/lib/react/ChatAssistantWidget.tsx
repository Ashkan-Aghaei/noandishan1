// ChatAssistantWidget.tsx — clean passThrough + no hover handlers + fixed transcription fallback

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// PDF.js (برای Vite)
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
// ===== Types =====
type Role = "user" | "assistant" | "system";
type FileLite = { name: string; text?: string; type?: string; size?: number; preview?: string };
type Msg = { id: string; role: Role; text?: string; files?: FileLite[] };

// ===== ENV =====
const RAW_API_URL = (import.meta.env.VITE_APP_API_URL || "").trim();
const API_URL = RAW_API_URL.replace(/\/+$/, "");
const CHAT_URL = `${API_URL}/v1/chat/completions`;
const TRANSCRIBE_URL = `${API_URL}/v1/audio/transcriptions`;

const API_KEY = (import.meta.env.VITE_APP_API_KEY || "").trim() || undefined;
const MODEL = (import.meta.env.VITE_APP_MODEL_NAME || "gpt-4o-mini").trim();
const TRANSCRIBE_MODEL = (import.meta.env.VITE_APP_TRANSCRIBE_MODEL || "whisper-1").trim();

if (import.meta.env.DEV) {
  console.log("[ChatAssistantWidget] env:", { API_URL, MODEL, TRANSCRIBE_MODEL, hasKey: !!API_KEY });
}

// ===== Utils =====

const uid = () => Math.random().toString(36).slice(2);

const ensureFontInjected = () => {
  const id = "vazirmatn-font-link";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }
};

// Extract readable text from a PDF file (client-side)
async function readPdfText(file: File, maxPages = 30) {
  // read file as ArrayBuffer
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  const parts: string[] = [];

  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = (content.items as any[])
      .map((it) => (it && typeof it === "object" && "str" in it ? (it as any).str : ""))
      .join(" ")
      .replace(/\s+\n/g, "\n")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (text) parts.push(`\n\n=== صفحه ${p} ===\n${text}`);
  }

  const joined = parts.join("\n");

  // محافظه‌کارانه: متن خیلی بلند رو کوتاه کن
  const MAX_CHARS = 20000;
  return joined.length > MAX_CHARS ? joined.slice(0, MAX_CHARS) + "\n\n...[بریدۀ طولانی]" : joined;
}

// ===== Theme =====
type ThemeName = "light" | "dark";
const PALETTES = {
  light: {
    bg: "#ffffff",
    bgSoft: "#fafafa",
    headerGrad: "linear-gradient(180deg,#ffffff,#fff8f3)",
    border: "#eaeaea",
    shadow: "0 20px 60px rgba(0,0,0,0.10)",
    text: "#1f2937",
    textMuted: "#6b7280",
    primary: "#ff7a00",
    primarySoft: "#fff1e6",
    primaryBorder: "#ffd2b3",
    bubbleUser: "#fff8f3",
    bubbleAsst: "#ffffff",
    inputBg: "#ffffff",
    inputBorder: "#e5e7eb",
    btnBg: "#ffffff",
    btnBorder: "#eaeaea",
    btnIcon: "#111827",
    floatBtnBg: "linear-gradient(180deg,#ff8a00,#ff6a00)",
    floatBtnBorder: "#ff8a00",
    ok: "#22c55e",
    warn: "#ff7a00",
  },
  dark: {
    bg: "#0b1020",
    bgSoft: "#0e1528",
    headerGrad: "linear-gradient(180deg,#0d1426,#0b1020)",
    border: "#1f2a44",
    shadow: "0 30px 80px rgba(0,0,0,0.45)",
    text: "#e5e7eb",
    textMuted: "#93a1c8",
    primary: "#ff8a00",
    primarySoft: "#1b140c",
    primaryBorder: "#3a2a1a",
    bubbleUser: "#18243f",
    bubbleAsst: "#0e1528",
    inputBg: "#0e1528",
    inputBorder: "#263353",
    btnBg: "#111827",
    btnBorder: "#263353",
    btnIcon: "#e5e7eb",
    floatBtnBg: "linear-gradient(180deg,#0f172a,#0b1220)",
    floatBtnBorder: "#0b1220",
    ok: "#22c55e",
    warn: "#f59e0b",
  },
} as const;

const MicIcon = ({ color = "#e5e7eb" }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke={color} strokeWidth="1.7" />
    <path d="M19 11a7 7 0 0 1-14 0" stroke={color} strokeWidth="1.7" />
    <path d="M12 18v3" stroke={color} strokeWidth="1.7" />
  </svg>
);
const SendIcon = ({ color = "#e5e7eb" }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 2 11 13" stroke={color} strokeWidth="1.7" />
    <path d="M22 2 15 22l-4-9-9-4 20-7Z" stroke={color} strokeWidth="1.7" fill="none" />
  </svg>
);
const ClipIcon = ({ color = "#e5e7eb" }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 8.5 10.5 19a5 5 0 0 1-7-7L14 1.5a4 4 0 0 1 6 6L9.5 18" stroke={color} strokeWidth="1.7" />
  </svg>
);
const SunIcon = ({ color = "#ff7a00" }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.7" />
    <path
      d="M12 2v2M12 20v2M2 12h2M20 12h2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
      stroke={color}
      strokeWidth="1.7"
    />
  </svg>
);
const MoonIcon = ({ color = "#e5e7eb" }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" stroke={color} strokeWidth="1.7" />
  </svg>
);

export default function ChatAssistantWidget() {
  const [theme, setTheme] = useState<ThemeName>("light");
  const P = PALETTES[theme];
  const prevGeomRef = useRef<typeof geom | null>(null);
  const [isFull, setIsFull] = useState(false);
 const persistedContextRef = useRef<string>("");
  const MAX_DOC_CONTEXT_CHARS = 20000; // برای جلوگیری از پرشدن توکن
  const styles = useMemo(
    () => ({
      floatingBtn: {
        position: "fixed" as const,
        right: 20,
        bottom: 30,
        width: 60,
        height: 60,
        borderRadius: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: theme === "light" ? "0 20px 50px rgba(0,0,0,0.18)" : "0 20px 50px rgba(0,0,0,0.22)",
        border: `1px solid ${P.floatBtnBorder}`,
        background: P.floatBtnBg,
        color: P.text,
        cursor: "pointer",
        zIndex: 9999,
      },
      panelWrapBase: {
        position: "fixed" as const,
        background: P.bg,
        borderRadius: 18,
        boxShadow: P.shadow,
        display: "flex",
        flexDirection: "column" as const,
        overflow: "hidden",
        border: `1px solid ${P.border}`,
        zIndex: 9999,
        fontFamily: "Vazirmatn, system-ui, -apple-system, Segoe UI, Roboto, Arial",
        direction: "rtl" as const,
        userSelect: "none" as const,
      },
      header: {
  position: "sticky" as const,   // ← اضافه کن
  top: 0,                        // ← اضافه کن
  zIndex: 1,                     // ← اضافه کن (بالای محتوا بمونه)
  padding: "10px 14px",
  borderBottom: `1px solid ${P.border}`,
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: P.headerGrad,
  color: P.text,
  cursor: "default",
},
      title: { fontSize: 14, fontWeight: 700 as const },
      badgeLive: {
        marginInlineStart: "auto",
        fontSize: 12,
        color: theme === "light" ? P.textMuted : "#a5b4fc",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      },
      messagesBox: {
        padding: 14,
        flex: 1,
        overflow: "auto" as const,
        background: P.bg,
      },
      bubble: {
        borderRadius: 14,
        padding: "10px 12px",
        margin: "6px 0",
        maxWidth: "82%",
        lineHeight: 1.7,
        whiteSpace: "pre-wrap" as const,
        wordBreak: "break-word" as const,
        fontSize: 14,
        border: `1px solid ${P.border}`,
        color: P.text,
      },
      inputWrap: {
        borderTop: `1px solid ${P.border}`,
        padding: 10,
        background: P.bg,
      },
      inputRow: {
        display: "grid",
        gridTemplateColumns: "1fr 40px",
        gap: 8,
        alignItems: "center",
      },
      input: {
        width: "100%",
        border: `1px solid ${P.inputBorder}`,
        borderRadius: 12,
        padding: "12px 14px",
        fontSize: 14,
        outline: "none",
        background: P.inputBg,
        color: P.text,
      },
      iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        border: `1px solid ${P.btnBorder}`,
        background: P.btnBg,
        color: P.btnIcon,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      },
      clipLabel: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: 12,
        border: `1px solid ${P.btnBorder}`,
        background: P.btnBg,
        color: P.btnIcon,
        cursor: "pointer",
      },
      resizeHandle: { position: "absolute" as const, background: "transparent" },
      hint: { fontSize: 12, color: P.textMuted },
    }),
    [P, theme],
  );

  // UI state
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(() => [{ id: uid(), role: "assistant", text: "سلام! 👋 ..." }] as Msg[]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState([] as FileLite[]);

  // Voice record
  const [recording, setRecording] = useState(false);

  // فقط با سیگنال وایت‌برد کنترل می‌شود
  const [passThrough, setPassThrough] = useState(false);

  // API عمومی (اگر لازم شد، دستی هم بتوانی بزنی)
  useEffect(() => {
    (window as any).ChatWidget_setPassThrough = (v: boolean) => setPassThrough(!!v);

    const onStart = () => setPassThrough(true);
    const onEnd = () => setPassThrough(false);

    window.addEventListener("wb:drawing-start", onStart as any);
    window.addEventListener("wb:drawing-end", onEnd as any);

    return () => {
      window.removeEventListener("wb:drawing-start", onStart as any);
      window.removeEventListener("wb:drawing-end", onEnd as any);
      delete (window as any).ChatWidget_setPassThrough;
    };
  }, []);

  const [transcribing, setTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Meter + timer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const [level, setLevel] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Panel geometry (resizable)
  const getInitGeom = () => {
    const W = typeof window !== "undefined" ? window.innerWidth : 1280;
    const H = typeof window !== "undefined" ? window.innerHeight : 800;
      // مقادیر جدیدی که خودت می‌خوای
  const initW = 360; // عرض دلخواه (کمتر از قبل)
  const initH = 800; // ارتفاع دلخواه (بزرگتر از قبل)

return {
  x: Math.max(W - initW - 20, 20), // راست ثابت می‌مونه
  y: Math.max(H - initH - 90, 20), // پایین ثابت می‌مونه
  w: Math.min(initW, W - 40),
  h: Math.min(initH, H - 100),
};
  };
  const [geom, setGeom] = useState(getInitGeom);
  const resizeRef = useRef(null as { type: string; startX: number; startY: number; startGeom: typeof geom } | null);

  const listRef = useRef(null as HTMLDivElement | null);
  const iconSrc = useMemo(() => `${import.meta.env.BASE_URL}chatbot-icon.png`, []);
  useEffect(() => {
    ensureFontInjected();
  }, []);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs, busy, open]);

  // ===== Files =====
  const extractTextIfPossible = (f: File): Promise<FileLite> => {
  const isImage = f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name);
  if (isImage) {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res({ name: f.name, type: f.type, size: f.size, preview: String(r.result || "") });
      r.readAsDataURL(f);
    });
  }

  // === NEW: PDF branch ===
  const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
  if (isPdf) {
    return (async () => {
      try {
        const text = await readPdfText(f);
        return { name: f.name, text, type: f.type, size: f.size };
      } catch {
        // اگر PDF خراب بود، حداقل اطلاعات فایل را برگردان
        return { name: f.name, type: f.type, size: f.size };
      }
    })();
  }

  const textual =
    /^text\//.test(f.type) ||
    /json|csv|xml|markdown|md/.test(f.type) ||
    /\.(txt|md|csv|json|xml)$/i.test(f.name);

  if (textual) {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res({ name: f.name, text: String(r.result || ""), type: f.type, size: f.size });
      r.readAsText(f);
    });
  }

  return Promise.resolve({ name: f.name, type: f.type, size: f.size });
};


  const pickFiles = useCallback(async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const fls = ev.target.files;
    if (!fls?.length) return;

    const isAudio = (f: File) => f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|webm)$/i.test(f.name);

    const nonAudio: File[] = [];
    const audio: File[] = [];
    Array.from(fls).forEach((f) => (isAudio(f) ? audio.push(f) : nonAudio.push(f)));

    if (nonAudio.length) {
      const arr = await Promise.all(nonAudio.map(extractTextIfPossible));
      setFiles((prev) => [...prev, ...arr]);
    }

    if (audio.length) {
      setTranscribing(true);
      try {
        for (const a of audio) {
          await transcribeAndInsertRef.current?.(a);
        }
      } catch (e: any) {
        console.error("audio upload transcribe error", e);
        alert("خطا در تبدیل فایل صوتی به متن: " + (e?.message || e));
      } finally {
        setTranscribing(false);
      }
    }

    ev.target.value = "";
  }, []);

  const removePending = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const onDrop = useCallback(async (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const dt = ev.dataTransfer;
    if (!dt?.files?.length) return;

    const filesArr = Array.from(dt.files);
    const isAudio = (f: File) => f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|webm)$/i.test(f.name);

    const nonAudio = filesArr.filter((f) => !isAudio(f));
    const audio = filesArr.filter(isAudio);

    if (nonAudio.length) {
      const arr = await Promise.all(nonAudio.map(extractTextIfPossible));
      setFiles((p) => [...p, ...arr]);
    }

    if (audio.length) {
      setTranscribing(true);
      try {
        for (const a of audio) {
          await transcribeAndInsertRef.current?.(a);
        }
      } catch (e: any) {
        console.error("drop audio transcribe error", e);
        alert("خطا در تبدیل فایل صوتی به متن: " + (e?.message || e));
      } finally {
        setTranscribing(false);
      }
    }
  }, []);

  const onDragOver = (ev: React.DragEvent<HTMLDivElement>) => ev.preventDefault();

  // ===== Chat payload =====
 const buildMessagesPayload = useCallback((userText: string, fls: FileLite[]) => {
  const MAX_ATTACH_CHARS = 12000;

  // 1) اول parts پیام کاربر را می‌سازیم
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];

  if (userText?.trim()) {
    parts.push({ type: "text", text: userText.trim() });
  }

  // 2) اگر فایل متنی همراه این پیام هست، هم به parts اضافه می‌کنیم
  //    هم persistedContextRef را به‌روزرسانی می‌کنیم تا برای پیام‌های بعدی باقی بماند
  const textFiles = (fls || []).filter((f) => !!f.text);
  if (textFiles.length) {
    const attachmentsText =
      "[ضمیمه‌ها]\n" +
      textFiles
        .map(
          (f, i) =>
            `(${i + 1}) ${f.name}\n` + (f.text || "").slice(0, MAX_ATTACH_CHARS)
        )
        .join("\n\n");

    // به پیام فعلی اضافه شود (دلخواه؛ می‌توانی حذفش کنی تا فقط در system context باشد)
    parts.push({ type: "text", text: attachmentsText });

    // ← مهم: کانتکست پایدار را به‌روز کنیم تا در پیام‌های بعدی هم همراه مدل برود
    const compacted = attachmentsText.slice(0, MAX_DOC_CONTEXT_CHARS);
    persistedContextRef.current = compacted;
  }

  // 3) تصاویر
  const imageFiles = (fls || []).filter(
    (f) =>
      (f.type?.startsWith("image/") || /^data:image\//.test(f.preview || "")) &&
      !!f.preview
  );
  const MAX_IMAGES = 6;
  imageFiles.slice(0, MAX_IMAGES).forEach((f) => {
    parts.push({ type: "text", text: `تصویر: ${f.name}` });
    parts.push({ type: "image_url", image_url: { url: f.preview as string } });
  });

  // 4) ساخت messages: همیشه اگر persistedContextRef پر بود،
  //    قبل از پیام کاربر یک system با «کانتکست اسناد» بفرست
  const messages: Array<{
    role: "system" | "user";
    content:
      | string
      | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
  }> = [
    {
      role: "system",
      content:
        "You are a helpful assistant. You can also understand and describe images. Explain step-by-step, keep it simple, add examples.",
    },
  ];

 if (persistedContextRef.current) {
  messages.push({
    role: "system",
    // system باید string باشد
    content: "Context from user documents:\n" + persistedContextRef.current,
  });
}


  messages.push({ role: "user", content: parts });
  return messages;
}, [persistedContextRef]);


  // ===== Voice recording & transcription =====
  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      } as MediaTrackConstraints,
    });

    // MediaRecorder
    const mr = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 64000,
    });
    audioChunksRef.current = [];
    mr.ondataavailable = (e) => e.data.size && audioChunksRef.current.push(e.data);
    mr.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
      setTranscribing(true);

      try {
        const doTranscribe = transcribeAndInsertRef.current;
        if (doTranscribe) {
          await doTranscribe(blob);
        } else {
          // --- Single clean fallback request ---
          if (!API_URL || !API_KEY) {
            alert("برای تبدیل ویس به متن، API_URL و API_KEY را تنظیم کنید.");
          } else {
            const fd = new FormData();
            fd.append("file", new File([blob], "voice.webm", { type: blob.type || "audio/webm" }));
            fd.append("model", TRANSCRIBE_MODEL);
            fd.append("language", "fa");
            fd.append("translate", "false");
            fd.append("temperature", "0");
            const resp = await fetch(TRANSCRIBE_URL, {
              method: "POST",
              headers: { Authorization: `Bearer ${API_KEY}` },
              body: fd,
            });
            const json = await resp.json();
            if (!resp.ok) throw new Error(json?.error?.message || "Transcription failed");
            const outText = json.text || json?.result || "";
            setInput((prev) => (prev ? prev + "\n" + outText : outText));
          }
        }
      } catch (err: any) {
        console.error("onstop transcription error", err);
        alert("خطا در تبدیل ویس به متن: " + (err?.message || err));
      } finally {
        setTranscribing(false);
        // cleanup meter/timer
        stream.getTracks().forEach((t) => t.stop());
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        if (timerIdRef.current) {
          window.clearInterval(timerIdRef.current);
          timerIdRef.current = null;
        }
        setLevel(0);
        setElapsedMs(0);
        analyserRef.current = null;
        srcNodeRef.current = null;
        if (audioCtxRef.current) {
          try {
            audioCtxRef.current.close();
          } catch {}
          audioCtxRef.current = null;
        }
      }
    };

    mediaRecorderRef.current = mr;
    mr.start();
    setRecording(true);

    // === Audio meter (Web Audio API) ===
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AC();
    audioCtxRef.current = audioCtx;
    const src = audioCtx.createMediaStreamSource(stream);
    srcNodeRef.current = src;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;
    src.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel((prev) => Math.max(rms, prev * 0.8));
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);

    // === Timer ===
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    timerIdRef.current = window.setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current!);
    }, 200) as unknown as number;
  }, []);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setRecording(false);
  }, []);

  // ===== Voice transcription via ref =====
  const transcribeAndInsertRef = useRef<null | ((blob: Blob) => Promise<void>)>(null);

  useEffect(() => {
    transcribeAndInsertRef.current = async (blob: Blob) => {
      if (!API_URL || !API_KEY) {
        alert("برای تبدیل ویس به متن، API_URL و API_KEY را تنظیم کنید.");
        return;
      }
      try {
        const fd = new FormData();
        fd.append("file", new File([blob], "voice.webm", { type: blob.type || "audio/webm" }));
        fd.append("model", TRANSCRIBE_MODEL);
        const resp = await fetch(TRANSCRIBE_URL, { method: "POST", headers: { Authorization: `Bearer ${API_KEY}` }, body: fd });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error?.message || "Transcription failed");
        const text = json.text || json?.result || "";
        setInput((prev) => (prev ? prev + "\n" + text : text));
      } catch (err: any) {
        console.error("transcription error", err);
        alert("خطا در تبدیل ویس به متن: " + (err?.message || err));
      }
    };
  }, []);
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (timerIdRef.current) window.clearInterval(timerIdRef.current);
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
      }
    };
  }, []);

  // ===== Send =====
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text && files.length === 0) return;
    if (!API_URL) {
      alert("VITE_APP_API_URL تنظیم نشده است.");
      return;
    }
    if (!API_KEY) {
      alert("VITE_APP_API_KEY تنظیم نشده است.");
      return;
    }

    setBusy(true);
    const userMsg: Msg = { id: uid(), role: "user", text, files: [...files] };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setFiles([]);

    try {
      const messages = buildMessagesPayload(text, userMsg.files || []);
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
          "User-Agent": "Excalidraw-Student-Aide",
        },
        body: JSON.stringify({ model: MODEL, messages }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error?.message || "Chat API error");
      const assistantText: string = json?.choices?.[0]?.message?.content || "پاسخی دریافت نشد.";
      setMsgs((m) => [...m, { id: uid(), role: "assistant", text: assistantText }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { id: uid(), role: "assistant", text: `❌ خطا در پاسخ: ${e?.message || e}` }]);
    } finally {
      setBusy(false);
    }
  }, [files, input, buildMessagesPayload]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy) send();
    }
  };

  // ===== Resizing =====
  const beginResize = (type: string, e: React.MouseEvent) => {
    resizeRef.current = { type, startX: e.clientX, startY: e.clientY, startGeom: { ...geom } };
    window.addEventListener("mousemove", onResizing);
    window.addEventListener("mouseup", endResize);
  };
  const onResizing = (e: MouseEvent) => {
    if (!resizeRef.current) return;
    const { type, startX, startY, startGeom } = resizeRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const g = { ...startGeom };
    const minW = 360,
      minH = 320,
      maxW = Math.max(420, window.innerWidth - 40),
      maxH = Math.max(360, window.innerHeight - 40);
    if (type.includes("e")) g.w = Math.min(maxW, Math.max(minW, startGeom.w + dx));
    if (type.includes("s")) g.h = Math.min(maxH, Math.max(minH, startGeom.h + dy));
    if (type.includes("w")) {
      g.x = Math.min(startGeom.x + dx, startGeom.x + startGeom.w - minW);
      g.w = Math.max(minW, startGeom.w - dx);
    }
    if (type.includes("n")) {
      g.y = Math.min(startGeom.y + dy, startGeom.y + startGeom.h - minH);
      g.h = Math.max(minH, startGeom.h - dy);
    }
    setGeom(g);
  };
  const endResize = () => {
    window.removeEventListener("mousemove", onResizing);
    window.removeEventListener("mouseup", endResize);
    resizeRef.current = null;
  };

  // ===== Render =====
  const panelStyle: React.CSSProperties = {
    left: geom.x,
    top: geom.y,
    width: geom.w,
    height: geom.h,
    ...styles.panelWrapBase,
    // وقتی واقعاً در حال رسم هستیم (wb:drawing-start → end)، چت عبوری شود
    pointerEvents: passThrough ? "none" : "auto",
  };

  return (
    <>
      {/* Floating Button */}
      <button
        type="button"
        aria-label="Open chat"
        style={styles.floatingBtn}
        onClick={() => setOpen((s) => !s)}
        title={open ? "بستن گفتگو" : "گفتگو با دستیار"}
      >
        <img
          src={iconSrc}
          alt="chatbot"
          width={28}
          height={28}
          style={{ display: "block", pointerEvents: "none", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = `${import.meta.env.BASE_URL}logo.png`;
          }}
        />
      </button>

      {open && (
        <div style={panelStyle} onDragOver={onDragOver} onDrop={onDrop}>
          {/* Resize handles */}
          <div style={{ ...styles.resizeHandle, top: 0, left: 0, right: 0, height: 6, cursor: "ns-resize" }} onMouseDown={(e) => beginResize("n", e)} />
          <div style={{ ...styles.resizeHandle, bottom: 0, left: 0, right: 0, height: 6, cursor: "ns-resize" }} onMouseDown={(e) => beginResize("s", e)} />
          <div style={{ ...styles.resizeHandle, top: 0, bottom: 0, left: 0, width: 6, cursor: "ew-resize" }} onMouseDown={(e) => beginResize("w", e)} />
          <div style={{ ...styles.resizeHandle, top: 0, bottom: 0, right: 0, width: 6, cursor: "ew-resize" }} onMouseDown={(e) => beginResize("e", e)} />
          <div style={{ ...styles.resizeHandle, top: 0, left: 0, width: 10, height: 10, cursor: "nwse-resize" }} onMouseDown={(e) => beginResize("nw", e)} />
          <div style={{ ...styles.resizeHandle, top: 0, right: 0, width: 10, height: 10, cursor: "nesw-resize" }} onMouseDown={(e) => beginResize("ne", e)} />
          <div style={{ ...styles.resizeHandle, bottom: 0, left: 0, width: 10, height: 10, cursor: "nesw-resize" }} onMouseDown={(e) => beginResize("sw", e)} />
          <div style={{ ...styles.resizeHandle, bottom: 0, right: 0, width: 10, height: 10, cursor: "nwse-resize" }} onMouseDown={(e) => beginResize("se", e)} />

          <div ref={listRef} style={styles.messagesBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <img
                src={iconSrc}
                alt="chatbot"
                width={18}
                height={18}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `${import.meta.env.BASE_URL}logo.png`;
                }}
              />
              <div style={{ fontWeight: 700 }}>دستیار هوش مصنوعی نواندیشان</div>
              <div style={{  ...styles.badgeLive }}>
                <span style={{ width: 8, height: 8, borderRadius: 9999, background: busy ? P.warn : P.ok, display: "inline-block" }} />
                {busy ? "در حال تولید…" : "آماده"}
                <button
                aria-label={isFull ? "خروج از تمام‌صفحه" : "تمام‌صفحه"}
                onClick={() => {
                    setGeom((g) => {
                    if (!isFull) {
                        prevGeomRef.current = g;
                        return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
                    } else {
                        return prevGeomRef.current || g;
                    }
                    });
                    setIsFull((v) => !v);
                }}
                style={{
                    marginInlineStart: 8,
                    ...styles.iconBtn,
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    borderColor: P.primaryBorder,
                }}
                title={isFull ? "خروج از تمام‌صفحه" : "تمام‌صفحه"}
                >
                {isFull ? "🗗" : "⛶"}
                </button>
              </div>
            </div>

            {msgs.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end" }}>
                <div
                  style={{
                    ...styles.bubble,
                    background:
                      m.role === "user"
                        ? theme === "light"
                          ? PALETTES.light.bubbleUser
                          : PALETTES.dark.bubbleUser
                        : theme === "light"
                        ? PALETTES.light.bubbleAsst
                        : PALETTES.dark.bubbleAsst,
                  }}
                >
                  {!!m.text && <div>{m.text}</div>}
                  {!!(m.files && m.files.length) && (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                      {m.files.map((f, i) => (
                        <span
                          key={i}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            background: theme === "light" ? P.primarySoft : "#141a2e",
                            border: `1px solid ${theme === "light" ? P.primaryBorder : P.border}`,
                            color: theme === "light" ? P.primary : "#c7d2fe",
                            padding: "6px 10px",
                            borderRadius: 999,
                          }}
                          title={f.text?.slice(0, 200) || `${f.type || "file"} • ${(f.size || 0) / 1024 | 0}KB`}
                        >
                          📄 {f.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div style={{ ...styles.bubble, width: "fit-content", background: theme === "light" ? P.bubbleAsst : P.bubbleAsst }}>در حال نوشتن…</div>}
          </div>

          {/* Pending attachments */}
          {files.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
                padding: 8,
                marginBottom: 8,
                border: `1px dashed ${P.border}`,
                borderRadius: 12,
                background: theme === "light" ? P.primarySoft : "#111827",
              }}
            >
              {files.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 10,
                    border: `1px solid ${theme === "light" ? P.primaryBorder : P.border}`,
                    background: theme === "light" ? "#fff" : "#0e1528",
                  }}
                  title={f.text?.slice(0, 200) || `${f.type || "file"} • ${(f.size || 0) / 1024 | 0}KB`}
                >
                  {f.preview ? (
                    <img src={f.preview} alt={f.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, border: `1px solid ${P.border}` }} />
                  ) : (
                    <span style={{ fontSize: 12 }}>📄 {f.name}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    aria-label="حذف"
                    title="حذف"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 8,
                      border: `1px solid ${P.btnBorder}`,
                      background: P.btnBg,
                      color: P.btnIcon,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={styles.inputWrap}>
            <div style={styles.inputRow}>
              <input
                type="text"
                placeholder="سوالت را بنویس… (Enter = ارسال)"
                style={styles.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={busy}
                aria-label="message"
              />
              <button
                type="button"
                onClick={() => !busy && send()}
                style={{ ...styles.iconBtn, borderColor: P.primaryBorder, boxShadow: theme === "light" ? "0 2px 10px rgba(255,122,0,0.15)" : "0 2px 10px rgba(255,138,0,0.12)" }}
                disabled={busy}
                aria-label="ارسال"
                title="ارسال"
              >
                <SendIcon color={theme === "light" ? "#111827" : "#e5e7eb"} />
              </button>
            </div>

            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <label style={styles.clipLabel} title="پیوست فایل">
      <ClipIcon color={theme === "light" ? "#111827" : "#e5e7eb"} />
      <input type="file" multiple style={{ display: "none" }} onChange={pickFiles} />
    </label>

    {!recording ? (
      <button type="button" style={styles.iconBtn} onClick={startRecording} aria-label="ضبط صدا" title="ضبط" disabled={transcribing}>
        <MicIcon color={theme === "light" ? "#111827" : "#e5e7eb"} />
      </button>
    ) : (
    <div />
    )}

    {transcribing && <span style={{ fontSize: 12, color: P.textMuted, marginInlineStart: 6 }}>در حال تبدیل…</span>}
  </div>

 
</div>
          </div>
        </div>
      )}
    </>
  );
}
