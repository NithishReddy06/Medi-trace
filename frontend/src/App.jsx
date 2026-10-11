import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark" aria-hidden="true">+</span>
      <span>MediTrace</span>
    </Link>
  );
}

function Layout({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="/#how-it-works">How it works</a>
          <a href="/#review-notes">Review notes</a>
          <Link className="nav-action" to="/prescriptions/new">Start a review</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer>MEDI<span>TRACE</span> / Prescription safety workspace</footer>
    </div>
  );
}

function HomePage() {
  return (
    <>
      <section className="home-page page-width">
        <div className="home-copy">
          <p className="eyebrow">A CLEARER FIRST REVIEW</p>
          <h1>Prescription details, made easier to follow.</h1>
          <p className="lede">
            MediTrace helps you turn a prescription image into readable text and organized medicine details, so important information is easier to review.
          </p>
          <Link className="primary-button" to="/prescriptions/new">
            Verify a prescription <span aria-hidden="true">-&gt;</span>
          </Link>
          <div className="trust-row">
            <span>Simple to use</span>
            <span>OCR assisted</span>
            <span>Review before use</span>
          </div>
        </div>
        <div className="home-visual" aria-label="Prescription analysis preview">
          <div className="visual-caption">A SMALL STEP / 01</div>
          <div className="document-sheet">
            <div className="sheet-top"><span className="mini-cross">+</span><span>CLINICAL NOTE</span><span>07 SEP</span></div>
            <div className="scribble wide" /><div className="scribble medium" /><div className="scribble short" />
            <div className="highlight"><span>Rx</span><b>Medication details</b><i>organized</i></div>
            <div className="scribble wide" /><div className="scribble medium" />
            <div className="sheet-signature">ready for review</div>
          </div>
          <div className="visual-stamp">MT<br /><strong>01</strong></div>
        </div>
      </section>
      <section className="feature-band">
        <div className="page-width feature-grid">
          <div className="feature-intro"><p className="eyebrow">WHY MEDITRACE</p><h2>Less guesswork.<br />More clarity.</h2></div>
          <div className="feature-item"><span>01</span><h3>See the source text</h3><p>Keep the original OCR output visible so you can compare it with the image.</p></div>
          <div className="feature-item"><span>02</span><h3>Find medicine details</h3><p>View names, dosage, frequency, duration, and quantity in one place.</p></div>
          <div className="feature-item"><span>03</span><h3>Stay in control</h3><p>Warnings and missing fields make manual review part of the workflow.</p></div>
        </div>
      </section>
      <section className="steps-section page-width" id="how-it-works">
        <div><p className="eyebrow">HOW IT WORKS</p><h2>From image to understanding.</h2></div>
        <div className="steps-list"><div><b>01</b><span>Upload a clear prescription image</span></div><div><b>02</b><span>MediTrace reads and organizes the text</span></div><div><b>03</b><span>Review the result before taking action</span></div></div>
      </section>
      <section className="review-notes page-width" id="review-notes">
        <div><p className="eyebrow">DESIGNED FOR CAREFUL REVIEW</p><h2>Useful information,<br />without false certainty.</h2></div>
        <div className="notes-copy"><p>MediTrace keeps the original OCR text beside the structured result. That makes it easier to spot missing details, compare the image, and decide what needs a closer look.</p><div className="note-points"><span><b>01</b>Raw text stays visible</span><span><b>02</b>Missing fields are called out</span><span><b>03</b>Warnings encourage manual review</span></div></div>
      </section>
    </>
  );
}

function EmptyResult() {
  return (
    <div className="empty-result">
      <span className="empty-icon" aria-hidden="true">+</span>
      <div><p className="eyebrow">READY WHEN YOU ARE</p><strong>Your review appears here</strong><p>Upload a clear prescription image to see OCR text and detected medicine details.</p></div>
    </div>
  );
}

function Field({ label, value }) {
  return <div className="result-field"><span>{label}</span><strong>{value || "Not detected"}</strong></div>;
}

function ResultPanel({ result }) {
  if (!result) return <EmptyResult />;
  const prescription = result.prescription || {};
  const medicines = prescription.medicines || [];

  return (
    <div className="results-stack">
      <div className="result-header"><div><p className="eyebrow">ANALYSIS COMPLETE</p><h2>Prescription overview</h2></div><span className="confidence">{result.confidence?.overall || "review"} confidence</span></div>
      {result.warnings?.length > 0 && <div className="warning-box"><span>!</span><div>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></div>}
      <section className="result-card">
        <div className="card-heading"><span className="section-number">01</span><h3>People &amp; date</h3></div>
        <div className="field-grid"><Field label="Doctor" value={prescription.doctorName} /><Field label="License number" value={prescription.licenseNumber} /><Field label="Patient" value={prescription.patientName} /><Field label="Date" value={prescription.date} /></div>
      </section>
      <section className="result-card">
        <div className="card-heading"><span className="section-number">02</span><h3>Medicines</h3><span className="count-badge">{medicines.length} detected</span></div>
        {medicines.length ? <div className="medicine-list">{medicines.map((medicine, index) => <div className="medicine-row" key={`${medicine.name}-${index}`}><div className="medicine-index">0{index + 1}</div><div className="medicine-main"><strong>{medicine.name || "Unnamed medicine"}</strong><span>{medicine.dosage || "Dosage not detected"}</span></div><div><small>FREQUENCY</small><b>{medicine.frequency || "Not detected"}</b></div><div><small>DURATION</small><b>{medicine.duration || "Not detected"}</b></div><div><small>QUANTITY</small><b>{medicine.quantity || "Not detected"}</b></div></div>)}</div> : <p className="muted">No medicines were detected. Review the OCR text manually.</p>}
      </section>
      <section className="ocr-card"><div className="card-heading"><span className="section-number">03</span><h3>Raw OCR text</h3></div><pre>{result.ocrText || "No text detected."}</pre></section>
    </div>
  );
}

function PrescriptionPage() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return undefined; }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function selectFile(event) {
    const selected = event.target.files?.[0];
    setError("");
    setResult(null);
    setFile(null);
    if (!selected) return;
    if (!["image/jpeg", "image/png"].includes(selected.type)) {
      setError("Choose a JPG, JPEG, or PNG image.");
      event.target.value = "";
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("The image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setFile(selected);
  }

  async function analyzeImage(event) {
    event.preventDefault();
    if (!file) { setError("Select a prescription image first."); return; }
    setIsLoading(true); setError(""); setResult(null);
    const formData = new FormData();
    formData.append("prescriptionImage", file);
    try {
      const response = await fetch(`${API_URL}/api/prescriptions/analyze`, { method: "POST", body: formData });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!data) throw new Error("The server returned an unexpected response.");
      if (!response.ok || !data.success) throw new Error(data.message || "The prescription could not be analyzed.");
      setResult(data);
    } catch (requestError) {
      setError(requestError.name === "TypeError" ? "Could not connect to MediTrace. Check that the backend is running." : requestError.message || "The prescription could not be analyzed.");
    } finally { setIsLoading(false); }
  }

  return (
    <section className="analysis-page page-width">
      <div className="page-intro"><button className="back-button" onClick={() => navigate(-1)}>&lt; Back</button><p className="eyebrow">NEW REVIEW</p><h1>Verify a prescription</h1><p>Select a clear image. MediTrace will read the text and organize the details for your review.</p></div>
      <div className="analysis-layout">
        <form className="upload-panel" onSubmit={analyzeImage}>
          <div className="panel-heading"><div><span className="section-number">01</span><h2>Prescription image</h2></div><span className="file-limit">JPG / PNG &middot; 5 MB max</span></div>
          <label className={`drop-zone ${previewUrl ? "has-preview" : ""}`} htmlFor="prescription-image">
            {previewUrl ? <img src={previewUrl} alt="Selected prescription preview" /> : <><span className="upload-icon">↑</span><strong>Choose an image</strong><span>or drop it here</span></>}
            <input id="prescription-image" type="file" accept="image/jpeg,image/png" onChange={selectFile} />
          </label>
          {file && <div className="file-meta"><span>{file.name}</span><button type="button" onClick={() => setFile(null)}>Remove</button></div>}
          {error && <div className="error-box" role="alert"><span>!</span>{error}</div>}
          <button className="primary-button analyze-button" disabled={isLoading} type="submit">{isLoading ? <><span className="spinner" /> Reading prescription...</> : <>Analyze image <span aria-hidden="true">-&gt;</span></>}</button>
          <div className="upload-guide">
            <strong>For the clearest result</strong>
            <span><b>01</b> Use a flat, well-lit image</span>
            <span><b>02</b> Keep all four corners visible</span>
            <span><b>03</b> Check the extracted text manually</span>
          </div>
          <p className="privacy-note">Local prototype storage only. MediTrace assists review and does not replace clinical judgment.</p>
        </form>
        <div className="results-panel"><ResultPanel result={result} /></div>
      </div>
    </section>
  );
}

export default function App() {
  return <Layout><Routes><Route path="/" element={<HomePage />} /><Route path="/prescriptions/new" element={<PrescriptionPage />} /></Routes></Layout>;
}
