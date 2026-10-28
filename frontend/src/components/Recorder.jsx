import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { api } from "../lib/api";
import { formatTime } from "../lib/speech";

// One button records and times together. Listen back, try again, then send once.
const FORMATS = [["audio/webm;codecs=opus", "webm"], ["audio/webm", "webm"], ["audio/ogg;codecs=opus", "ogg"], ["audio/mp4", "m4a"]];
const supported = typeof window !== "undefined" && !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
const format = (supported && FORMATS.find((f) => MediaRecorder.isTypeSupported?.(f[0]))) || ["", "webm"];

export default function Recorder({ task, limits, sendUrl, onSent }) {
  const target = task.minutes * 60;
  const maxSeconds = limits.max_record_minutes * 60;
  const maxBytes = limits.max_upload_mb * 1024 * 1024;
  const [stage, setStage] = useState("idle"); // idle | live | review
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(!supported);
  const rec = useRef({ recorder: null, stream: null, chunks: [], blob: null, timer: null, seconds: 0 });
  const stopRef = useRef(null);
  const audioRef = useRef(null);

  const stopStream = () => {
    rec.current.stream?.getTracks().forEach((t) => t.stop());
    rec.current.stream = null;
  };
  useEffect(() => () => { stopStream(); clearInterval(rec.current.timer); }, []);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);
  useEffect(() => { if (stage === "live") stopRef.current?.focus(); if (stage === "review") audioRef.current?.focus(); }, [stage]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = format[0] ? new MediaRecorder(stream, { mimeType: format[0] }) : new MediaRecorder(stream);
      Object.assign(rec.current, { stream, recorder, chunks: [], blob: null, seconds: 0 });
      recorder.ondataavailable = (e) => e.data?.size && rec.current.chunks.push(e.data);
      recorder.onstop = finished;
      recorder.start(1000);
      setSeconds(0);
      rec.current.timer = setInterval(() => {
        rec.current.seconds += 1;
        setSeconds(rec.current.seconds);
        if (rec.current.seconds >= maxSeconds) recorder.stop();
      }, 1000);
      setStage("live");
    } catch (err) {
      stopStream();
      setUploadOpen(true);
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setError("Your browser blocked the microphone. Click the microphone or lock symbol in the address bar, allow the microphone, then press Start recording again.");
      } else if (err?.name === "NotFoundError") {
        setError("No microphone was found. Connect one, or upload a voice memo from your phone instead.");
      } else {
        setError("The recording couldn't start. You can upload a voice memo from your phone instead.");
      }
    }
  };

  function finished() {
    const r = rec.current;
    stopStream();
    clearInterval(r.timer);
    const blob = new Blob(r.chunks, { type: r.recorder.mimeType || format[0] || "audio/webm" });
    if (!blob.size || r.seconds < 1) {
      setError("Nothing was recorded. Check your microphone and try again.");
      setStage("idle");
      return;
    }
    r.blob = blob;
    setBlobUrl(URL.createObjectURL(blob));
    setStage("review");
  }

  const stop = () => rec.current.recorder?.state !== "inactive" && rec.current.recorder?.stop();

  const send = async (file, name) => {
    if (sending) return;
    if (file.size > maxBytes) return setError(`That recording is bigger than ${limits.max_upload_mb} MB. Record a shorter answer.`);
    setSending(true);
    setError(null);
    const form = new FormData();
    form.append("audio", file, name);
    try {
      const { submission } = await api(sendUrl, { method: "POST", form });
      onSent(submission);
    } catch (e) {
      setError(`${e.message} ${stage === "review" ? "Your recording is still here, so you can try again." : ""}`);
      setSending(false);
    }
  };

  const minutes = task.minutes;
  const over = seconds >= target;
  const longEnough = seconds >= target * 0.75;

  return (
    <section className="panel answer-panel" id="answer" aria-labelledby="answer-title">
      {stage === "idle" && (
        <div>
          <h2 id="answer-title">Your answer</h2>
          <p className="goal">Speak for about <b>{minutes} minutes</b>. You can listen and try again before sending.</p>
          {supported
            ? <button className="btn btn-primary btn-block rec-start" type="button" onClick={start}><Icon name="speaking" />Start recording</button>
            : <p className="muted small">Recording isn't available in this browser. Record a voice memo on your phone and upload it below.</p>}
        </div>
      )}

      {stage === "live" && (
        <div className={`rec-box${over ? " is-over" : ""}`}>
          <div className="rec-top">
            <span className="rec-dot" aria-hidden="true" />
            <span className="rec-time">{formatTime(seconds)}</span>
            <span className="rec-of">of about {minutes}:00</span>
          </div>
          <div className="rec-track" aria-hidden="true"><i style={{ width: `${Math.min(100, (seconds / target) * 100)}%` }} /></div>
          <p className="rec-hint">{over ? `That's about ${minutes} minutes. Finish your sentence, then press Stop.` : "Recording… keep talking. Look at the questions below for ideas."}</p>
          <button ref={stopRef} className="btn btn-block rec-stop" type="button" onClick={stop}><Icon name="stop" />Stop recording</button>
        </div>
      )}

      {stage === "review" && (
        <div>
          <h2>Listen to your answer</h2>
          <audio ref={audioRef} className="audio" controls src={blobUrl} />
          <p className={`rec-check ${longEnough ? "good" : "short"}`}>
            {longEnough
              ? `✓ ${formatTime(seconds)} recorded, close to the ${minutes} minutes.`
              : `${formatTime(seconds)} recorded. The exam asks for about ${minutes} minutes. Listen, then try again for a longer answer, or send it as it is.`}
          </p>
          <div className="rec-choices">
            <button className="btn btn-secondary" type="button" aria-disabled={sending} onClick={() => { audioRef.current?.pause(); start(); }}><Icon name="again" />Try again</button>
            <button className="btn btn-primary" type="button" aria-disabled={sending} onClick={() => send(rec.current.blob, `answer.${format[1]}`)}>{sending ? "Sending…" : "Send to teacher"}</button>
          </div>
          <p className="muted small" style={{ margin: "var(--s3) 0 0" }}>You can send only one answer, and it can't be changed after sending.</p>
          <div className="after-send"><b>After you send:</b> your teacher listens and gives you points and feedback. You'll see it on this page.</div>
        </div>
      )}

      {error && <p className="form-errors small" role="alert" style={{ marginTop: "var(--s3)" }}>{error}</p>}

      {stage === "idle" && <UploadAlt open={uploadOpen} setOpen={setUploadOpen} maxMb={limits.max_upload_mb} sending={sending}
        onUpload={(file) => send(file, file.name)} />}
    </section>
  );
}

function UploadAlt({ open, setOpen, maxMb, sending, onUpload }) {
  const [file, setFile] = useState(null);
  return (
    <details className="upload-alt" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>No microphone? Upload a voice memo instead</summary>
      <form className="upload-answer" onSubmit={(e) => { e.preventDefault(); if (file) onUpload(file); }}>
        <div className="field">
          <label htmlFor="answer-file">Your recording</label>
          <input type="file" id="answer-file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" onChange={(e) => setFile(e.target.files[0] || null)} aria-describedby="answer-file-help" />
          <p className="help" id="answer-file-help">MP3, M4A, WAV, OGG or WebM, up to {maxMb} MB. You can send only one answer.</p>
        </div>
        <button className="btn btn-secondary" type="submit" aria-disabled={!file || sending}>{sending ? "Sending…" : "Send file to teacher"}</button>
      </form>
    </details>
  );
}
