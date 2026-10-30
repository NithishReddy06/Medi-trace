import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const SESSION_STORAGE_KEY = "meditrace-auth-session";
const ROLE_HOME = {
  patient: "/patient",
  pharmacist: "/pharmacist",
  doctor: "/doctor",
  admin: "/admin",
  auditor: "/dashboard",
};
const AuthContext = createContext(null);

function getRoleHome(role) {
  return ROLE_HOME[role] || "/dashboard";
}

function readStoredSession() {
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    async function restoreSession() {
      if (!session?.token) {
        if (isCurrent) setIsRestoring(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await response.json();

        if (!response.ok || !data.user) throw new Error("Session expired");
        const nextSession = { token: session.token, user: data.user };
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
        if (isCurrent) setSession(nextSession);
      } catch {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        if (isCurrent) setSession(null);
      } finally {
        if (isCurrent) setIsRestoring(false);
      }
    }

    restoreSession();
    return () => { isCurrent = false; };
  }, []);

  function startSession(nextSession) {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function endSession() {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
  }

  return <AuthContext.Provider value={{ session, user: session?.user || null, isRestoring, startSession, endSession }}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider.");
  return auth;
}

function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">M</span>
      <span>MediTrace</span>
    </Link>
  );
}

function Layout({ children }) {
  const { user, endSession } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <nav className="site-nav" aria-label="Primary navigation">
          {user ? (
            <>
              <Link to={getRoleHome(user.role)}>My dashboard</Link>
              <span className="user-chip">{user.firstName} · {user.role}</span>
              <button className="logout-button" type="button" onClick={endSession}>Sign out</button>
            </>
          ) : (
            <>
              <a href="/#how-it-works">How it works</a>
              <a href="/#review-notes">Review principles</a>
              <Link className="nav-action" to="/login">Sign in <span aria-hidden="true">↗</span></Link>
            </>
          )}
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <span>MEDI</span>TRACE <i /> Prescription review workspace{" "}
        <small>Prototype · human review required</small>
      </footer>
    </div>
  );
}

function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> Prescription review desk
          </p>
          <h1>
            Read the prescription.
            <br />
            <em>Keep the decision human.</em>
          </h1>
          <p className="lede">
            MediTrace turns a prescription image into reviewable details,
            keeping the original text close so pharmacists can check every
            important field.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to={user ? getRoleHome(user.role) : "/login"}>
              {user ? "Open my dashboard" : "Sign in to MediTrace"} <span aria-hidden="true">→</span>
            </Link>
            <a className="text-link" href="/#how-it-works">
              See the workflow <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero-notes">
            <span>
              <b>01</b> OCR-assisted
            </span>
            <span>
              <b>02</b> Original text retained
            </span>
            <span>
              <b>03</b> Review required
            </span>
          </div>
        </div>
        <div className="review-sheet" aria-label="Prescription review preview">
          <div className="review-rail">
            <span>REVIEW</span>
            <b>01</b>
          </div>
          <div className="sheet-content">
            <div className="sheet-heading">
              <span>MEDICATION ORDER</span>
              <time>REVIEW COPY</time>
            </div>
            <div className="sheet-rule" />
            <div className="sheet-person">
              <small>PRESCRIBER</small>
              <strong>Dr. Olivia Carter</strong>
              <small>PATIENT</small>
              <strong>Liam Bennett</strong>
            </div>
            <div className="medicine-preview">
              <small>DETECTED MEDICINE</small>
              <b>Amoxicillin</b>
              <span>500 mg · Oral · 3 times daily</span>
            </div>
            <div className="sheet-warning">
              <span>!</span>
              <p>
                <b>Review signal</b> Allergy information requires verification.
              </p>
            </div>
            <div className="sheet-footer">
              <span>OCR + HUMAN REVIEW</span>
              <span>MEDI/TRACE</span>
            </div>
          </div>
        </div>
      </section>
      <section className="workflow-strip" id="how-it-works">
        <div className="page-width">
          <p className="eyebrow">
            <span /> Review sequence
          </p>
          <div className="workflow-grid">
            <article>
              <b>01</b>
              <h2>Upload</h2>
              <p>Add a clear JPG or PNG prescription image.</p>
            </article>
            <article>
              <b>02</b>
              <h2>Read</h2>
              <p>OCR extracts raw text and key medicine details.</p>
            </article>
            <article>
              <b>03</b>
              <h2>Verify</h2>
              <p>Compare structured details with the source before acting.</p>
            </article>
          </div>
        </div>
      </section>
      <section className="review-principles page-width" id="review-notes">
        <div>
          <p className="eyebrow">
            <span /> Designed for careful work
          </p>
          <h2>
            Useful structure,
            <br />
            without false certainty.
          </h2>
        </div>
        <div className="principle-copy">
          <p>
            MediTrace treats OCR as a starting point. It calls out missing
            details and keeps the source text visible, so the person reviewing
            the prescription remains in control.
          </p>
          <div className="principle-list">
            <span>
              <b>Source-first</b> Raw OCR text remains visible.
            </span>
            <span>
              <b>Clear gaps</b> Missing fields are highlighted.
            </span>
            <span>
              <b>Human decision</b> No automatic approval is implied.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

function EmptyResult({ isLoading }) {
  return (
    <div className="empty-result" aria-live="polite">
      <div className={`empty-icon ${isLoading ? "is-reading" : ""}`}>
        {isLoading ? <span className="spinner" /> : "↗"}
      </div>
      <div>
        <p className="eyebrow">
          <span /> {isLoading ? "Reading image" : "Ready for review"}
        </p>
        <strong>
          {isLoading
            ? "Extracting prescription details"
            : "Your review will appear here"}
        </strong>
        <p>
          {isLoading
            ? "This can take a moment. Keep this page open while MediTrace reads the image."
            : "Choose a clear prescription image to view OCR text and detected medicine details."}
        </p>
      </div>
    </div>
  );
}
function Field({ label, value }) {
  return (
    <div className="result-field">
      <span>{label}</span>
      <strong>{value || "Not detected"}</strong>
    </div>
  );
}

function ResultPanel({ result, isLoading }) {
  if (!result) return <EmptyResult isLoading={isLoading} />;
  const prescription = result.prescription || {};
  const medicines = prescription.medicines || [];
  return (
    <div className="results-stack">
      <div className="result-header">
        <div>
          <p className="eyebrow">
            <span /> OCR output
          </p>
          <h2>Review summary</h2>
        </div>
        <span className="confidence">
          {result.confidence?.overall || "review"} confidence
        </span>
      </div>
      {result.warnings?.length > 0 && (
        <div className="warning-box" role="status">
          <span>!</span>
          <div>
            {result.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      )}
      <section className="result-card">
        <div className="card-heading">
          <span className="section-number">01</span>
          <h3>People and date</h3>
        </div>
        <div className="field-grid">
          <Field label="Prescriber" value={prescription.doctorName} />
          <Field label="License number" value={prescription.licenseNumber} />
          <Field label="Patient" value={prescription.patientName} />
          <Field label="Issue date" value={prescription.date} />
        </div>
      </section>
      <section className="result-card">
        <div className="card-heading">
          <span className="section-number">02</span>
          <h3>Detected medicines</h3>
          <span className="count-badge">{medicines.length} found</span>
        </div>
        {medicines.length ? (
          <div className="medicine-list">
            {medicines.map((medicine, index) => (
              <div className="medicine-row" key={`${medicine.name}-${index}`}>
                <div className="medicine-index">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="medicine-main">
                  <strong>{medicine.name || "Unnamed medicine"}</strong>
                  <span>{medicine.dosage || "Dosage not detected"}</span>
                </div>
                <div>
                  <small>Frequency</small>
                  <b>{medicine.frequency || "Not detected"}</b>
                </div>
                <div>
                  <small>Duration</small>
                  <b>{medicine.duration || "Not detected"}</b>
                </div>
                <div>
                  <small>Quantity</small>
                  <b>{medicine.quantity || "Not detected"}</b>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            No medicines were detected. Read the original OCR text and add
            details manually.
          </p>
        )}
      </section>
      <section className="ocr-card">
        <div className="card-heading">
          <span className="section-number">03</span>
          <h3>Original OCR text</h3>
          <span className="source-label">Source reference</span>
        </div>
        <pre>{result.ocrText || "No text detected."}</pre>
      </section>
    </div>
  );
}

function formatFileSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 2)} MB`;
}

function PrescriptionPage() {
  const { session } = useAuth();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  function selectFile(selected) {
    setError("");
    setResult(null);
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFile(null);
      setError("Choose a JPG, JPEG, or PNG image.");
      return;
    }
    if (selected.size === 0) {
      setFile(null);
      setError("The selected image is empty. Choose another file.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("The image must be 5 MB or smaller.");
      return;
    }
    setFile(selected);
  }
  function handleInputChange(event) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }
  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  }
  function openPicker() {
    if (!isLoading) inputRef.current?.click();
  }
  async function analyzeImage(event) {
    event.preventDefault();
    if (!file) {
      setError("Choose a prescription image before starting the review.");
      return;
    }
    setIsLoading(true);
    setError("");
    setResult(null);
    const formData = new FormData();
    formData.append("prescriptionImage", file);
    try {
      const response = await fetch(`${API_URL}/api/prescriptions/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: formData,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : null;
      if (!data) throw new Error("The server returned an unexpected response.");
      if (!response.ok || !data.success)
        throw new Error(
          data.message || "The prescription could not be analyzed.",
        );
      setResult(data);
    } catch (requestError) {
      setError(
        requestError.name === "TypeError"
          ? "Could not connect to MediTrace. Check that the backend is running, then try again."
          : requestError.message || "The prescription could not be analyzed.",
      );
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <section className="analysis-page page-width">
      <div className="page-intro">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back to overview
        </button>
        <p className="eyebrow">
          <span /> New review
        </p>
        <h1>Start with the source.</h1>
        <p>
          Upload a legible prescription image. MediTrace organizes what it reads
          for your review; it never replaces clinical judgement.
        </p>
      </div>
      <div className="analysis-layout">
        <form className="upload-panel" onSubmit={analyzeImage} noValidate>
          <div className="panel-heading">
            <div>
              <span className="section-number">01</span>
              <h2>Prescription image</h2>
            </div>
            <span className="file-limit">JPG or PNG · 5 MB max</span>
          </div>
          <input
            ref={inputRef}
            className="sr-only"
            id="prescription-image"
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleInputChange}
          />
          <div
            className={`drop-zone ${previewUrl ? "has-preview" : ""} ${isDragging ? "is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Selected prescription preview" />
            ) : (
              <>
                <span className="upload-icon" aria-hidden="true">
                  ↑
                </span>
                <strong>Drop the image here</strong>
                <span>or choose it from your device</span>
                <button
                  type="button"
                  className="browse-button"
                  onClick={openPicker}
                >
                  Browse image
                </button>
              </>
            )}
          </div>
          {file && (
            <div className="file-meta">
              <div>
                <span className="file-name">{file.name}</span>
                <small>{formatFileSize(file.size)} · ready to read</small>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                Remove
              </button>
            </div>
          )}
          {error && (
            <div className="error-box" role="alert">
              <span>!</span>
              <div>
                <b>Review could not start</b>
                <p>{error}</p>
              </div>
            </div>
          )}
          <button
            className="primary-button analyze-button"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? (
              <>
                <span className="spinner" /> Reading image
              </>
            ) : (
              <>
                Read prescription <span aria-hidden="true">→</span>
              </>
            )}
          </button>
          <div className="upload-guide">
            <strong>For a reliable result</strong>
            <span>
              <b>01</b> Use a well-lit, flat image
            </span>
            <span>
              <b>02</b> Keep all corners visible
            </span>
            <span>
              <b>03</b> Verify every extracted detail
            </span>
          </div>
          <p className="privacy-note">
            Prototype storage only. Do not upload real patient data outside an
            approved environment.
          </p>
        </form>
        <div className="results-panel">
          <ResultPanel result={result} isLoading={isLoading} />
        </div>
      </div>
    </section>
  );
}

function RouteLoading() {
  return <section className="route-loading page-width" aria-live="polite"><span className="spinner" /> Restoring your secure session…</section>;
}

function ProtectedRoute({ allowedRoles, children }) {
  const { user, isRestoring } = useAuth();
  const location = useLocation();

  if (isRestoring) return <RouteLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to={getRoleHome(user.role)} replace />;

  return children;
}

function LoginPage() {
  const { user, startSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to={getRoleHome(user.role)} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter both your email address and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok || !data.token || !data.user) {
        throw new Error(data.message || "Could not sign in.");
      }

      startSession({ token: data.token, user: data.user });
      const requestedPath = location.state?.from?.pathname;
      navigate(requestedPath?.startsWith("/") ? requestedPath : getRoleHome(data.user.role), { replace: true });
    } catch (requestError) {
      setError(requestError.name === "TypeError" ? "Could not reach MediTrace. Check that the backend is running." : requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return <section className="login-page page-width">
    <div className="login-intro"><p className="eyebrow"><span /> Secure workspace</p><h1>Sign in to continue your review.</h1><p>Access is assigned by role. Your dashboard and available actions are based on your MediTrace account.</p></div>
    <form className="login-card" onSubmit={handleSubmit} noValidate>
      <div className="login-card-heading"><span className="section-number">01</span><div><p className="eyebrow"><span /> Account access</p><h2>Welcome back</h2></div></div>
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "login-error" : undefined} placeholder="you@example.com" disabled={isSubmitting} />
      <label htmlFor="password">Password</label>
      <div className="password-field"><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "login-error" : undefined} placeholder="Enter your password" disabled={isSubmitting} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={isSubmitting}>{showPassword ? "Hide" : "Show"}</button></div>
      {error && <div className="login-error" id="login-error" role="alert"><b>Sign-in failed</b><p>{error}</p></div>}
      <button className="primary-button login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="spinner" /> Signing in</> : <>Sign in securely <span aria-hidden="true">→</span></>}</button>
      <p className="account-switch">Patient? <Link to="/register">Create an account</Link></p>
      <p className="account-switch">Pharmacist? <Link to="/register?role=pharmacist">Apply for professional access</Link></p>
    </form>
  </section>;
}

function RegisterPage() {
  const { user, startSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountType = new URLSearchParams(location.search).get("role") === "pharmacist" ? "pharmacist" : "patient";
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "", password: "", confirmPassword: "" });
  const [professional, setProfessional] = useState({ licenseNumber: "", organization: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to={getRoleHome(user.role)} replace />;
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || (accountType === "patient" && !form.dateOfBirth) || !form.password) {
      setError("Complete all required fields."); return;
    }
    if (accountType === "pharmacist" && (!professional.licenseNumber.trim() || !professional.organization.trim())) {
      setError("Enter your pharmacist license number and organization."); return;
    }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.password.length < 8) { setError("Password must contain at least 8 characters."); return; }
    setIsSubmitting(true);
    try {
      const isPharmacist = accountType === "pharmacist";
      const response = await fetch(`${API_URL}/api/auth/${isPharmacist ? "pharmacist-applications" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          ...(isPharmacist ? professional : { dateOfBirth: form.dateOfBirth }),
          password: form.password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not create your account.");
      if (isPharmacist) {
        setSuccess(data.message || "Your pharmacist access request was submitted for review.");
        setForm({ firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "", password: "", confirmPassword: "" });
        setProfessional({ licenseNumber: "", organization: "" });
        return;
      }
      if (!data.token || !data.user) throw new Error(data.message || "Could not create your account.");
      startSession({ token: data.token, user: data.user });
      navigate("/patient", { replace: true });
    } catch (requestError) { setError(requestError.name === "TypeError" ? "Could not reach MediTrace. Check that the backend is running." : requestError.message); } finally { setIsSubmitting(false); }
  }

  return <section className="login-page page-width register-page">
    <div className="login-intro">
      <p className="eyebrow"><span /> {accountType === "patient" ? "Patient account" : "Pharmacist access"}</p>
      <h1>{accountType === "patient" ? "Create your safety profile." : "Apply for pharmacist access."}</h1>
      <p>{accountType === "patient" ? "Maintain your allergy and medicine-reaction information, and view your prescription updates." : "Submit your professional details for administrator review. Pharmacist access is enabled only after your license is checked."}</p>
      <div className="login-assurance">
        {accountType === "patient" ? <><span>✓ Patient account</span><span>✓ Password protected</span><span>✓ Add safety details after registration</span></> : <><span>✓ License number required</span><span>✓ Access stays locked while pending</span><span>✓ Administrator approval required</span></>}
      </div>
    </div>
    <form className="login-card register-card" onSubmit={handleSubmit} noValidate>
      <div className="login-card-heading"><span className="section-number">01</span><div><p className="eyebrow"><span /> New account</p><h2>{accountType === "patient" ? "Create patient account" : "Request pharmacist access"}</h2></div></div>
      <div className="account-type-switch" aria-label="Choose account type">
        <Link className={accountType === "patient" ? "is-selected" : ""} aria-current={accountType === "patient" ? "page" : undefined} to="/register">Patient</Link>
        <Link className={accountType === "pharmacist" ? "is-selected" : ""} aria-current={accountType === "pharmacist" ? "page" : undefined} to="/register?role=pharmacist">Pharmacist</Link>
      </div>
      <div className="register-fields"><label>First name<input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} autoComplete="given-name" required maxLength="100" disabled={isSubmitting} /></label><label>Last name<input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} autoComplete="family-name" required maxLength="100" disabled={isSubmitting} /></label></div>
      <label>Email address<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required maxLength="320" disabled={isSubmitting} /></label>
      {accountType === "patient" ? <div className="register-fields"><label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} required disabled={isSubmitting} /></label><label>Phone number <small>Optional</small><input value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" maxLength="30" disabled={isSubmitting} /></label></div> : <><label>Pharmacist license number<input value={professional.licenseNumber} onChange={(event) => setProfessional((current) => ({ ...current, licenseNumber: event.target.value }))} autoComplete="off" required maxLength="100" disabled={isSubmitting} /></label><label>Organization or pharmacy<input value={professional.organization} onChange={(event) => setProfessional((current) => ({ ...current, organization: event.target.value }))} autoComplete="organization" required maxLength="200" disabled={isSubmitting} /></label><label>Phone number <small>Optional</small><input value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" maxLength="30" disabled={isSubmitting} /></label></>}
      <label>Password<input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" required minLength="8" maxLength="128" disabled={isSubmitting} /></label>
      <label>Confirm password<input type="password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} autoComplete="new-password" required minLength="8" maxLength="128" disabled={isSubmitting} /></label>
      {error && <div className="login-error" role="alert"><b>{accountType === "patient" ? "Account could not be created" : "Request could not be submitted"}</b><p>{error}</p></div>}
      {success && <div className="registration-success" role="status"><b>Request submitted</b><p>{success}</p><Link to="/login">Return to sign in</Link></div>}
      <button className="primary-button login-submit" type="submit" disabled={isSubmitting || Boolean(success)}>{isSubmitting ? <><span className="spinner" /> Submitting</> : accountType === "patient" ? <>Create patient account <span aria-hidden="true">→</span></> : <>Submit access request <span aria-hidden="true">→</span></>}</button>
      <p className="account-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </form>
  </section>;
}

const EMPTY_ALLERGY = { allergenName: "", reactionDescription: "", severity: "moderate" };
const EMPTY_REACTION = () => ({ medicineId: "", reactionDescription: "", severity: "moderate", reactionDate: new Date().toISOString().slice(0, 10) });

function prettyLabel(value) {
  return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PatientModule() {
  const { session } = useAuth();
  const [profile, setProfile] = useState(null);
  const [allergies, setAllergies] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [allergyForm, setAllergyForm] = useState(EMPTY_ALLERGY);
  const [reactionForm, setReactionForm] = useState(EMPTY_REACTION);
  const [editingAllergyId, setEditingAllergyId] = useState(null);
  const [editingReactionId, setEditingReactionId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function patientRequest(path, options = {}) {
    const response = await fetch(`${API_URL}/api/patient${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${session.token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "The request could not be completed.");
    return data;
  }

  async function loadPatientData() {
    setIsLoading(true);
    setError("");
    try {
      const [profileData, allergyData, reactionData, prescriptionData, medicineData] = await Promise.all([
        patientRequest("/profile"),
        patientRequest("/allergies"),
        patientRequest("/reactions"),
        patientRequest("/prescriptions"),
        patientRequest("/medicines"),
      ]);
      setProfile(profileData.profile);
      setAllergies(allergyData.allergies || []);
      setReactions(reactionData.reactions || []);
      setPrescriptions(prescriptionData.prescriptions || []);
      setMedicines(medicineData.medicines || []);
    } catch (requestError) {
      setError(requestError.name === "TypeError" ? "Could not connect to MediTrace. Check that the backend is running." : requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadPatientData(); }, []);

  function clearMessages() {
    setError("");
    setNotice("");
  }

  async function saveProfile(event) {
    event.preventDefault();
    clearMessages();
    setIsSaving(true);
    try {
      const data = await patientRequest("/profile", { method: "PATCH", body: JSON.stringify(profile) });
      setProfile(data.profile);
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function cancelAllergyEdit() {
    setEditingAllergyId(null);
    setAllergyForm(EMPTY_ALLERGY);
  }

  async function saveAllergy(event) {
    event.preventDefault();
    clearMessages();
    setIsSaving(true);
    try {
      const data = await patientRequest(
        editingAllergyId ? `/allergies/${editingAllergyId}` : "/allergies",
        { method: editingAllergyId ? "PATCH" : "POST", body: JSON.stringify(allergyForm) },
      );
      setAllergies((current) => editingAllergyId
        ? current.map((allergy) => allergy.id === editingAllergyId ? data.allergy : allergy)
        : [data.allergy, ...current]);
      cancelAllergyEdit();
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function startAllergyEdit(allergy) {
    clearMessages();
    setEditingAllergyId(allergy.id);
    setAllergyForm({ allergenName: allergy.allergenName, reactionDescription: allergy.reactionDescription || "", severity: allergy.severity });
  }

  function cancelReactionEdit() {
    setEditingReactionId(null);
    setReactionForm(EMPTY_REACTION());
  }

  async function saveReaction(event) {
    event.preventDefault();
    clearMessages();
    setIsSaving(true);
    try {
      const data = await patientRequest(
        editingReactionId ? `/reactions/${editingReactionId}` : "/reactions",
        { method: editingReactionId ? "PATCH" : "POST", body: JSON.stringify(reactionForm) },
      );
      setReactions((current) => editingReactionId
        ? current.map((reaction) => reaction.id === editingReactionId ? data.reaction : reaction)
        : [data.reaction, ...current]);
      cancelReactionEdit();
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function startReactionEdit(reaction) {
    clearMessages();
    setEditingReactionId(reaction.id);
    setReactionForm({ medicineId: reaction.medicineId, reactionDescription: reaction.reactionDescription, severity: reaction.severity, reactionDate: reaction.reactionDate });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    clearMessages();
    setIsSaving(true);
    try {
      const path = deleteTarget.type === "allergy" ? `/allergies/${deleteTarget.id}` : `/reactions/${deleteTarget.id}`;
      const data = await patientRequest(path, { method: "DELETE" });
      if (deleteTarget.type === "allergy") setAllergies((current) => current.filter((allergy) => allergy.id !== deleteTarget.id));
      else setReactions((current) => current.filter((reaction) => reaction.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <RouteLoading />;

  return <section className="patient-page page-width">
    <div className="patient-heading">
      <div><p className="eyebrow"><span /> Patient safety profile</p><h1>Your health information, kept ready for review.</h1><p>Keep your details, allergies, and medication reactions current. A pharmacist reviews verified safety information before prescription decisions are made.</p></div>
      <button className="secondary-button" type="button" onClick={loadPatientData} disabled={isSaving}>Refresh information</button>
    </div>

    <div className="patient-safety-note"><span aria-hidden="true">!</span><p><b>For your safety:</b> This workspace records information for pharmacist review. It does not replace urgent medical care or a clinician’s advice.</p></div>
    {error && <div className="patient-message is-error" role="alert"><b>Something needs attention</b><span>{error}</span></div>}
    {notice && <div className="patient-message is-success" role="status"><b>Saved</b><span>{notice}</span></div>}

    <div className="patient-summary">
      <article><span>{String(allergies.length).padStart(2, "0")}</span><b>Allergy records</b><small>Safety profile entries</small></article>
      <article><span>{String(reactions.length).padStart(2, "0")}</span><b>Reported reactions</b><small>Medicine history entries</small></article>
      <article><span>{String(prescriptions.length).padStart(2, "0")}</span><b>Prescriptions</b><small>Visible to your account</small></article>
    </div>

    <div className="patient-layout">
      <div className="patient-primary-stack">
        <section className="patient-card" id="profile">
          <div className="patient-card-heading"><div><span className="section-number">01</span><h2>Personal profile</h2></div><span className="record-tag">Your account</span></div>
          <form className="patient-form profile-form" onSubmit={saveProfile} noValidate>
            <label>Email address<input value={profile?.email || ""} disabled aria-label="Email address" /></label>
            <label>First name<input value={profile?.firstName || ""} onChange={(event) => setProfile((current) => ({ ...current, firstName: event.target.value }))} required maxLength="100" /></label>
            <label>Last name<input value={profile?.lastName || ""} onChange={(event) => setProfile((current) => ({ ...current, lastName: event.target.value }))} required maxLength="100" /></label>
            <label>Phone number<input value={profile?.phone || ""} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} maxLength="30" placeholder="Optional" /></label>
            <label>Date of birth<input type="date" value={profile?.dateOfBirth || ""} onChange={(event) => setProfile((current) => ({ ...current, dateOfBirth: event.target.value }))} required /></label>
            <div className="profile-action"><button className="primary-button" type="submit" disabled={isSaving}>Save profile <span aria-hidden="true">→</span></button></div>
          </form>
        </section>

        <section className="patient-card">
          <div className="patient-card-heading"><div><span className="section-number">02</span><h2>Allergy safety profile</h2></div><span className="record-tag">Patient reported</span></div>
          <p className="patient-card-copy">Add every known allergy, including the reaction you experienced. Self-reported entries remain visible for pharmacist verification.</p>
          <form className="patient-form safety-form" onSubmit={saveAllergy} noValidate>
            <label>Allergen name<input value={allergyForm.allergenName} onChange={(event) => setAllergyForm((current) => ({ ...current, allergenName: event.target.value }))} placeholder="For example, Penicillin" required maxLength="200" /></label>
            <label>Severity<select value={allergyForm.severity} onChange={(event) => setAllergyForm((current) => ({ ...current, severity: event.target.value }))}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="unknown">Unknown</option></select></label>
            <label className="form-span-2">What reaction did you have?<textarea value={allergyForm.reactionDescription} onChange={(event) => setAllergyForm((current) => ({ ...current, reactionDescription: event.target.value }))} placeholder="For example, skin rash and itching" maxLength="2000" /></label>
            <div className="form-actions form-span-2"><button className="primary-button" type="submit" disabled={isSaving}>{editingAllergyId ? "Save allergy" : "Add allergy"} <span aria-hidden="true">→</span></button>{editingAllergyId && <button className="text-button" type="button" onClick={cancelAllergyEdit} disabled={isSaving}>Cancel edit</button>}</div>
          </form>
          <div className="record-list" aria-live="polite">{allergies.length ? allergies.map((allergy) => <article className="safety-record" key={allergy.id}><div><div className="record-title"><h3>{allergy.allergenName}</h3><span className={`severity-badge is-${allergy.severity}`}>{prettyLabel(allergy.severity)}</span></div><p>{allergy.reactionDescription || "Reaction details not recorded."}</p><small>{allergy.verificationStatus === "pharmacist_verified" ? "Pharmacist verified" : "Self-reported · awaiting verification"}</small></div><div className="record-actions">{allergy.verificationStatus === "self_reported" && <><button className="text-button" type="button" onClick={() => startAllergyEdit(allergy)} disabled={isSaving}>Edit</button><button className="danger-button" type="button" onClick={() => setDeleteTarget({ type: "allergy", id: allergy.id, name: allergy.allergenName })} disabled={isSaving}>Remove</button></>}</div></article>) : <p className="empty-record">No allergies recorded yet. Add an entry if you have a known allergy.</p>}</div>
        </section>

        <section className="patient-card">
          <div className="patient-card-heading"><div><span className="section-number">03</span><h2>Medicine reaction history</h2></div><span className="record-tag">Patient reported</span></div>
          <p className="patient-card-copy">Record past reactions to medicines so pharmacists can see relevant safety history while reviewing a prescription.</p>
          <form className="patient-form safety-form" onSubmit={saveReaction} noValidate>
            <label>Medicine<select value={reactionForm.medicineId} onChange={(event) => setReactionForm((current) => ({ ...current, medicineId: event.target.value }))} required><option value="">Choose a medicine</option>{medicines.map((medicine) => <option value={medicine.id} key={medicine.id}>{medicine.name} · {medicine.strength}</option>)}</select></label>
            <label>Severity<select value={reactionForm.severity} onChange={(event) => setReactionForm((current) => ({ ...current, severity: event.target.value }))}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="life_threatening">Life threatening</option><option value="unknown">Unknown</option></select></label>
            <label>Reaction date<input type="date" value={reactionForm.reactionDate} onChange={(event) => setReactionForm((current) => ({ ...current, reactionDate: event.target.value }))} required /></label>
            <label className="form-span-2">What reaction did you have?<textarea value={reactionForm.reactionDescription} onChange={(event) => setReactionForm((current) => ({ ...current, reactionDescription: event.target.value }))} placeholder="Describe the reaction" required maxLength="2000" /></label>
            <div className="form-actions form-span-2"><button className="primary-button" type="submit" disabled={isSaving}>{editingReactionId ? "Save reaction" : "Add reaction"} <span aria-hidden="true">→</span></button>{editingReactionId && <button className="text-button" type="button" onClick={cancelReactionEdit} disabled={isSaving}>Cancel edit</button>}</div>
          </form>
          <div className="record-list" aria-live="polite">{reactions.length ? reactions.map((reaction) => <article className="safety-record" key={reaction.id}><div><div className="record-title"><h3>{reaction.medicine.name} <small>{reaction.medicine.strength}</small></h3><span className={`severity-badge is-${reaction.severity}`}>{prettyLabel(reaction.severity)}</span></div><p>{reaction.reactionDescription}</p><small>{displayDate(reaction.reactionDate)} · {reaction.verificationStatus === "pharmacist_verified" ? "Pharmacist verified" : "Self-reported · awaiting verification"}</small></div><div className="record-actions">{reaction.verificationStatus === "self_reported" && <><button className="text-button" type="button" onClick={() => startReactionEdit(reaction)} disabled={isSaving}>Edit</button><button className="danger-button" type="button" onClick={() => setDeleteTarget({ type: "reaction", id: reaction.id, name: reaction.medicine.name })} disabled={isSaving}>Remove</button></>}</div></article>) : <p className="empty-record">No medicine reactions have been added yet.</p>}</div>
        </section>
      </div>

      <aside className="patient-prescriptions">
        <div className="patient-card-heading"><div><span className="section-number">04</span><h2>My prescriptions</h2></div><span className="record-tag">Read only</span></div>
        <p>Prescription status and patient-friendly safety messages appear here after the pharmacist workflow begins.</p>
        <div className="prescription-list">{prescriptions.length ? prescriptions.map((prescription) => <article className="patient-prescription" key={prescription.id}><div className="prescription-status"><span className={`status-badge is-${prescription.status}`}>{prettyLabel(prescription.status)}</span><time>{displayDate(prescription.issueDate)}</time></div><h3>Dr. {prescription.prescriber.firstName} {prescription.prescriber.lastName}</h3><p>{prescription.items.length ? prescription.items.map((item) => `${item.medicine.name} ${item.medicine.strength}`).join(", ") : "Medicine details will appear after review."}</p>{prescription.pharmacistNotes && <div className="pharmacist-note"><b>Pharmacist note</b><span>{prescription.pharmacistNotes}</span></div>}{prescription.safetyAlerts.map((alert) => <div className="patient-alert" key={alert.id}><b>{prettyLabel(alert.severity)}</b><span>{alert.message}</span></div>)}</article>) : <div className="empty-prescriptions"><span>↗</span><b>No prescriptions are visible yet.</b><p>When a prescription is uploaded for your account, its status will appear here.</p></div>}</div>
      </aside>
    </div>

    {deleteTarget && <div className="modal-backdrop" role="presentation"><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><span className="section-number">CONFIRM</span><h2 id="delete-title">Remove this {deleteTarget.type}?</h2><p>This will remove <b>{deleteTarget.name}</b> from your safety profile. Verified records cannot be removed here.</p><div className="form-actions"><button className="danger-solid-button" type="button" onClick={confirmDelete} disabled={isSaving}>{isSaving ? "Removing…" : "Remove record"}</button><button className="text-button" type="button" onClick={() => setDeleteTarget(null)} disabled={isSaving}>Keep record</button></div></div></div>}
  </section>;
}

function PharmacistModule() {
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [checkingPrescriptionId, setCheckingPrescriptionId] = useState(null);
  const [assessingFraudId, setAssessingFraudId] = useState(null);
  const [fraudResults, setFraudResults] = useState({});
  const [explainingPrescriptionId, setExplainingPrescriptionId] = useState(null);
  const [alertExplanations, setAlertExplanations] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastCheck, setLastCheck] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [resolvingAlertId, setResolvingAlertId] = useState(null);
  const [reviewingPrescriptionId, setReviewingPrescriptionId] = useState(null);

  async function pharmacistRequest(path, options = {}) {
    const response = await fetch(`${API_URL}/api/pharmacist${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${session.token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "The request could not be completed.");
    return data;
  }

  function clearMessages() {
    setError("");
    setNotice("");
  }

  async function searchPatients(event) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    clearMessages();
    setSelectedPatient(null);
    setLastCheck(null);
    if (trimmedQuery.length < 2) {
      setError("Enter at least two characters to search patients.");
      setPatients([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await pharmacistRequest(`/patients?query=${encodeURIComponent(trimmedQuery)}`);
      setPatients(data.patients || []);
      if (!(data.patients || []).length) setNotice("No patient records matched that search.");
    } catch (requestError) {
      setPatients([]);
      setError(requestError.name === "TypeError" ? "Could not connect to MediTrace. Check that the backend is running." : requestError.message);
    } finally {
      setIsSearching(false);
    }
  }

  async function loadPatient(patientId) {
    clearMessages();
    setIsLoadingProfile(true);
    setLastCheck(null);
    try {
      const data = await pharmacistRequest(`/patients/${patientId}/safety-profile`);
      setSelectedPatient(data.patient);
    } catch (requestError) {
      setSelectedPatient(null);
      setError(requestError.message);
    } finally {
      setIsLoadingProfile(false);
    }
  }

  async function runSafetyCheck(prescriptionId) {
    clearMessages();
    setAlertExplanations((current) => { const next = { ...current }; delete next[prescriptionId]; return next; });
    setCheckingPrescriptionId(prescriptionId);
    try {
      const data = await pharmacistRequest(`/prescriptions/${prescriptionId}/safety-check`, { method: "POST" });
      setLastCheck({ prescriptionId, alerts: data.alerts || [], checkedRules: data.checkedRules || [] });
      setNotice(data.message);
      const profileData = await pharmacistRequest(`/patients/${selectedPatient.id}/safety-profile`);
      setSelectedPatient(profileData.patient);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCheckingPrescriptionId(null);
    }
  }

  async function assessFraudRisk(prescriptionId) {
    clearMessages();
    setAssessingFraudId(prescriptionId);
    try {
      const data = await pharmacistRequest(`/prescriptions/${prescriptionId}/fraud-risk`, { method: "POST" });
      setFraudResults((current) => ({ ...current, [prescriptionId]: data.assessment }));
      setNotice("Fraud-risk assessment saved. It is advisory and does not decide the prescription outcome.");
      await refreshSelectedPatient();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAssessingFraudId(null);
    }
  }

  async function explainSavedAlerts(prescriptionId) {
    clearMessages();
    setExplainingPrescriptionId(prescriptionId);
    try {
      const data = await pharmacistRequest(`/prescriptions/${prescriptionId}/explain-alerts`, { method: "POST" });
      setAlertExplanations((current) => ({ ...current, [prescriptionId]: data }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExplainingPrescriptionId(null);
    }
  }

  async function refreshSelectedPatient() {
    const data = await pharmacistRequest(`/patients/${selectedPatient.id}/safety-profile`);
    setSelectedPatient(data.patient);
  }

  async function resolveAlert(alertId) {
    clearMessages();
    setResolvingAlertId(alertId);
    try {
      const data = await pharmacistRequest(`/alerts/${alertId}/resolve`, { method: "PATCH" });
      setNotice(data.message);
      setAlertExplanations({});
      await refreshSelectedPatient();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResolvingAlertId(null);
    }
  }

  async function submitReview(prescriptionId) {
    const draft = reviewDrafts[prescriptionId] || { status: "", notes: "" };
    clearMessages();
    if (!draft.status) {
      setError("Choose a final pharmacist decision before saving.");
      return;
    }
    setReviewingPrescriptionId(prescriptionId);
    try {
      const data = await pharmacistRequest(`/prescriptions/${prescriptionId}/review`, {
        method: "POST",
        body: JSON.stringify(draft),
      });
      setNotice(data.message);
      await refreshSelectedPatient();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReviewingPrescriptionId(null);
    }
  }

  return <section className="pharmacist-page page-width">
    <div className="pharmacist-heading">
      <div><p className="eyebrow"><span /> Pharmacist workspace</p><h1>Start with the patient safety record.</h1><p>Find the patient, review allergy and reaction history, then run deterministic checks against the prescription before making a clinical decision.</p></div>
      <div className="rules-card"><small>CHECK ENGINE</small><strong>Safety rules v1</strong><span>Allergy · reactions · interactions</span></div>
    </div>

    <div className="pharmacist-safety-note"><span aria-hidden="true">!</span><p><b>Decision support only:</b> A safety alert requires pharmacist assessment. No result automatically approves, rejects, or dispenses a prescription.</p></div>
    {error && <div className="patient-message is-error" role="alert"><b>Something needs attention</b><span>{error}</span></div>}
    {notice && <div className="patient-message is-success" role="status"><b>Safety check updated</b><span>{notice}</span></div>}

    <section className="pharmacist-search-card">
      <form onSubmit={searchPatients} className="patient-search-form" noValidate>
        <label htmlFor="patient-search">Find a patient</label>
        <div><input id="patient-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by patient name or email" maxLength="100" /><button className="primary-button" type="submit" disabled={isSearching}>{isSearching ? <><span className="spinner" /> Searching</> : <>Search patient <span aria-hidden="true">→</span></>}</button></div>
        <small>Use at least two characters. Only patient records are returned.</small>
      </form>
      {patients.length > 0 && <div className="patient-search-results" aria-live="polite">{patients.map((patient) => <button className={`patient-result ${selectedPatient?.id === patient.id ? "is-selected" : ""}`} type="button" key={patient.id} onClick={() => loadPatient(patient.id)} disabled={isLoadingProfile}><span className="patient-initials">{patient.firstName[0]}{patient.lastName[0]}</span><span><b>{patient.firstName} {patient.lastName}</b><small>{patient.email} · DOB {displayDate(patient.dateOfBirth)}</small></span><span className="patient-result-counts"><i>{patient.counts.allergies} allergies</i><i>{patient.counts.reactions} reactions</i><i>{patient.counts.prescriptions} prescriptions</i></span><strong>→</strong></button>)}</div>}
    </section>

    {isLoadingProfile && <RouteLoading />}
    {!isLoadingProfile && selectedPatient && <div className="pharmacist-review-layout">
      <div className="pharmacist-main-stack">
        <section className="pharmacist-card patient-identity-card">
          <div className="patient-card-heading"><div><span className="section-number">01</span><h2>{selectedPatient.firstName} {selectedPatient.lastName}</h2></div><span className="record-tag">Patient selected</span></div>
          <div className="identity-details"><div><small>Email</small><span>{selectedPatient.email}</span></div><div><small>Phone</small><span>{selectedPatient.phone || "Not recorded"}</span></div><div><small>Date of birth</small><span>{displayDate(selectedPatient.dateOfBirth)}</span></div><div><small>Safety data</small><span>{selectedPatient.allergies.length} allergies · {selectedPatient.reactions.length} reactions</span></div></div>
          <Link className="secondary-button patient-create-link" to="/pharmacist/new-prescription" state={{ patient: selectedPatient }}>Create prescription →</Link>
        </section>

        <section className="pharmacist-card">
          <div className="patient-card-heading"><div><span className="section-number">02</span><h2>Allergy safety profile</h2></div><span className="record-tag">Review before dispensing</span></div>
          <div className="pharmacist-record-list">{selectedPatient.allergies.length ? selectedPatient.allergies.map((allergy) => <article className="pharmacist-record" key={allergy.id}><div className="record-title"><h3>{allergy.allergenName}</h3><span className={`severity-badge is-${allergy.severity}`}>{prettyLabel(allergy.severity)}</span></div><p>{allergy.reactionDescription || "Reaction details not recorded."}</p><small>{allergy.allergenClass?.name || "No drug class linked"} · {prettyLabel(allergy.verificationStatus)}</small></article>) : <p className="empty-record">No allergies have been recorded for this patient.</p>}</div>
        </section>

        <section className="pharmacist-card">
          <div className="patient-card-heading"><div><span className="section-number">03</span><h2>Medicine reaction history</h2></div><span className="record-tag">Review before dispensing</span></div>
          <div className="pharmacist-record-list">{selectedPatient.reactions.length ? selectedPatient.reactions.map((reaction) => <article className="pharmacist-record" key={reaction.id}><div className="record-title"><h3>{reaction.medicine.name} <small>{reaction.medicine.strength}</small></h3><span className={`severity-badge is-${reaction.severity}`}>{prettyLabel(reaction.severity)}</span></div><p>{reaction.reactionDescription}</p><small>{displayDate(reaction.reactionDate)} · {prettyLabel(reaction.verificationStatus)}</small></article>) : <p className="empty-record">No previous medicine reactions have been recorded for this patient.</p>}</div>
        </section>
      </div>

      <aside className="prescription-review-panel">
        <div className="patient-card-heading"><div><span className="section-number">04</span><h2>Prescription review</h2></div><span className="record-tag">Human decision required</span></div>
        <p>Run database safety checks and a separate advisory ML risk assessment. The pharmacist makes the final decision.</p>
        <div className="pharmacist-prescription-list">{selectedPatient.prescriptions.length ? selectedPatient.prescriptions.map((prescription) => { const draft = reviewDrafts[prescription.id] || { status: "", notes: "" }; const openAlerts = prescription.items.flatMap((item) => item.safetyAlerts.filter((alert) => !alert.isResolved)); let savedExplanation = {}; try { savedExplanation = prescription.fraudAssessment?.explanation ? JSON.parse(prescription.fraudAssessment.explanation) : {}; } catch {} const fraudAssessment = fraudResults[prescription.id] || (prescription.fraudAssessment ? { ...prescription.fraudAssessment, ...savedExplanation } : null); return <article className="pharmacist-prescription" key={prescription.id}><div className="prescription-status"><span className={`status-badge is-${prescription.status}`}>{prettyLabel(prescription.status)}</span><time>{displayDate(prescription.issueDate)}</time></div><h3>Dr. {prescription.prescriber?.firstName} {prescription.prescriber?.lastName}</h3><div className="review-medicine-list">{prescription.items.map((item) => <div key={item.id}><b>{item.medicine.name}</b><span>{item.medicine.genericName} · {item.medicine.strength} · {item.frequency}</span></div>)}</div><button className="primary-button rule-check-button" type="button" onClick={() => runSafetyCheck(prescription.id)} disabled={checkingPrescriptionId !== null}>{checkingPrescriptionId === prescription.id ? <><span className="spinner" /> Checking rules</> : <>Run safety checks <span aria-hidden="true">→</span></>}</button><button className="secondary-button rule-check-button" type="button" onClick={() => assessFraudRisk(prescription.id)} disabled={assessingFraudId !== null}>{assessingFraudId === prescription.id ? <><span className="spinner" /> Assessing risk</> : <>Assess fraud risk with ML <span aria-hidden="true">→</span></>}</button>{fraudAssessment && <div className="fraud-result"><div><b>Risk score {Number(fraudAssessment.riskScore).toFixed(1)} / 100</b><span className={`risk-level is-${fraudAssessment.riskLevel}`}>{prettyLabel(fraudAssessment.riskLevel)} risk</span></div><small>{fraudAssessment.modelVersion} · {fraudAssessment.assessedAt ? new Date(fraudAssessment.assessedAt).toLocaleString() : "Saved assessment"}</small><ul>{(fraudAssessment.reasons || []).map((reason) => <li key={reason}>{reason}</li>)}</ul><p>{fraudAssessment.notice || "Synthetic coursework model; advisory only. Pharmacist review remains required."}</p></div>}{openAlerts.length > 0 && <div className="open-alert-list">{openAlerts.map((alert) => <div key={alert.id}><span className={`severity-badge is-${alert.severity}`}>{prettyLabel(alert.alertType)} · {prettyLabel(alert.severity)}</span><button className="text-button" type="button" onClick={() => resolveAlert(alert.id)} disabled={resolvingAlertId !== null}>{resolvingAlertId === alert.id ? "Addressing…" : "Mark addressed"}</button></div>)}</div>}
{openAlerts.length > 0 && <div className="alert-explain-controls"><button className="secondary-button" type="button" onClick={() => explainSavedAlerts(prescription.id)} disabled={explainingPrescriptionId !== null}>{explainingPrescriptionId === prescription.id ? "Preparing explanation…" : "Explain saved alerts"}</button><small>Only saved open alert text is sent to OpenAI when a key is configured.</small></div>}
{openAlerts.length > 0 && alertExplanations[prescription.id] && <div className="alert-explanation" role="status"><div><b>Saved-alert explanation</b><span>{alertExplanations[prescription.id].mode === "openai" ? "OpenAI · saved alerts only" : alertExplanations[prescription.id].mode === "local_fallback" ? "Local fallback · OpenAI unavailable" : "Local summary · no OpenAI key configured"}</span></div><p>{alertExplanations[prescription.id].explanation}</p><small>{alertExplanations[prescription.id].disclaimer}</small></div>}
<div className="review-decision"><label>Final decision<select value={draft.status} onChange={(event) => setReviewDrafts((current) => ({ ...current, [prescription.id]: { ...draft, status: event.target.value } }))}><option value="">Choose decision</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="escalated">Escalated</option><option value="finalized">Finalized</option></select></label><label>Pharmacist notes<textarea value={draft.notes} onChange={(event) => setReviewDrafts((current) => ({ ...current, [prescription.id]: { ...draft, notes: event.target.value } }))} placeholder="Required for rejection or escalation" maxLength="4000" /></label><button className="secondary-button" type="button" onClick={() => submitReview(prescription.id)} disabled={reviewingPrescriptionId !== null}>{reviewingPrescriptionId === prescription.id ? "Saving decision…" : "Save final decision"}</button></div>{lastCheck?.prescriptionId === prescription.id && <div className="check-result"><b>{lastCheck.alerts.length ? `${lastCheck.alerts.length} alert${lastCheck.alerts.length === 1 ? "" : "s"} found` : "No rule-based alerts"}</b>{lastCheck.alerts.length ? lastCheck.alerts.map((alert) => <p key={alert.id || `${alert.alertType}-${alert.message}`}><span className={`severity-badge is-${alert.severity}`}>{prettyLabel(alert.severity)}</span>{alert.message}</p>) : <p>The defined allergy, reaction, cross-reactivity, and interaction rules returned no matches. Clinical review is still required.</p>}</div>}</article> }) : <div className="empty-prescriptions"><span>↗</span><b>No prescriptions are available for this patient.</b><p>Once a prescription is uploaded, it can be checked here.</p></div>}</div>
      </aside>
    </div>}

    {!isLoadingProfile && !selectedPatient && !patients.length && !error && <div className="pharmacist-empty-state"><span>01</span><div><b>Search for a patient to begin the pharmacist workflow.</b><p>The patient profile is loaded only after you choose a search result, then the safety checks are run against a selected prescription.</p></div></div>}
  </section>;
}

const EMPTY_PRESCRIPTION_ITEM = () => ({ medicineId: "", doseAmount: "", doseUnit: "mg", frequency: "", route: "Oral", durationDays: "", quantity: "", instructions: "" });

function PrescriptionComposer() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const patient = location.state?.patient;
  const [prescribers, setPrescribers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [prescriberId, setPrescriberId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([EMPTY_PRESCRIPTION_ITEM()]);
  const [createdPrescription, setCreatedPrescription] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function pharmacistRequest(path, options = {}) {
    const response = await fetch(`${API_URL}/api/pharmacist${path}`, { ...options, headers: { Authorization: `Bearer ${session.token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "The request could not be completed.");
    return data;
  }

  useEffect(() => {
    if (!patient) return;
    let current = true;
    Promise.all([pharmacistRequest("/prescribers"), pharmacistRequest("/medicines")]).then(([prescriberData, medicineData]) => {
      if (!current) return;
      setPrescribers(prescriberData.prescribers || []);
      setMedicines(medicineData.medicines || []);
      if (prescriberData.prescribers?.[0]) setPrescriberId(prescriberData.prescribers[0].id);
    }).catch((requestError) => current && setError(requestError.name === "TypeError" ? "Could not connect to MediTrace. Check that the backend is running." : requestError.message)).finally(() => current && setIsLoading(false));
    return () => { current = false; };
  }, []);

  function updateItem(index, field, value) { setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)); }
  function removeItem(index) { setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)); }

  async function createPrescription(event) {
    event.preventDefault();
    setError(""); setNotice(""); setIsSaving(true);
    try {
      const data = await pharmacistRequest("/prescriptions", { method: "POST", body: JSON.stringify({ patientId: patient.id, prescriberId, issueDate, items }) });
      setCreatedPrescription(data.prescription);
      setNotice(data.message);
    } catch (requestError) { setError(requestError.message); } finally { setIsSaving(false); }
  }

  async function uploadSource() {
    if (!file || !createdPrescription) { setError("Choose a prescription image first."); return; }
    if (!ACCEPTED_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_FILE_SIZE) { setError("Choose a non-empty JPG or PNG image that is 5 MB or smaller."); return; }
    setError(""); setNotice(""); setIsUploading(true);
    const formData = new FormData(); formData.append("prescriptionImage", file);
    try {
      const response = await fetch(`${API_URL}/api/prescriptions/${createdPrescription.id}/image`, { method: "POST", headers: { Authorization: `Bearer ${session.token}` }, body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not upload the prescription image.");
      setNotice(`Source image stored. OCR found ${data.prescription?.medicines?.length || 0} medicine entries; compare it with the manually entered prescription before review.`);
    } catch (requestError) { setError(requestError.name === "TypeError" ? "Could not connect to MediTrace. Check that the backend is running." : requestError.message); } finally { setIsUploading(false); }
  }

  if (!patient) return <Navigate to="/pharmacist" replace />;
  if (isLoading) return <RouteLoading />;
  return <section className="composer-page page-width"><div className="page-intro"><button className="back-button" type="button" onClick={() => navigate("/pharmacist")}>← Back to pharmacist workspace</button><p className="eyebrow"><span /> New prescription</p><h1>Create the review record first.</h1><p>Patient: <b>{patient.firstName} {patient.lastName}</b>. Enter the prescription details from the source, then upload the image for OCR support and run safety checks from the pharmacist workspace.</p></div>{error && <div className="patient-message is-error" role="alert"><b>Something needs attention</b><span>{error}</span></div>}{notice && <div className="patient-message is-success" role="status"><b>Prescription workflow</b><span>{notice}</span></div>}<div className="composer-layout"><form className="composer-card" onSubmit={createPrescription} noValidate><div className="patient-card-heading"><div><span className="section-number">01</span><h2>Prescription details</h2></div><span className="record-tag">Manual verification</span></div><div className="composer-top-fields"><label>Prescriber<select value={prescriberId} onChange={(event) => setPrescriberId(event.target.value)} disabled={Boolean(createdPrescription)} required><option value="">Choose prescriber</option>{prescribers.map((prescriber) => <option value={prescriber.id} key={prescriber.id}>Dr. {prescriber.firstName} {prescriber.lastName} · {prescriber.specialization}</option>)}</select></label><label>Issue date<input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} disabled={Boolean(createdPrescription)} required /></label></div><div className="composer-items">{items.map((item, index) => <fieldset key={index} disabled={Boolean(createdPrescription)}><legend>Medicine {String(index + 1).padStart(2, "0")}</legend><div className="composer-item-grid"><label className="composer-span-2">Medicine<select value={item.medicineId} onChange={(event) => updateItem(index, "medicineId", event.target.value)} required><option value="">Choose medicine</option>{medicines.map((medicine) => <option value={medicine.id} key={medicine.id}>{medicine.name} · {medicine.genericName} · {medicine.strength}</option>)}</select></label><label>Dose amount<input inputMode="decimal" value={item.doseAmount} onChange={(event) => updateItem(index, "doseAmount", event.target.value)} placeholder="500" required /></label><label>Dose unit<input value={item.doseUnit} onChange={(event) => updateItem(index, "doseUnit", event.target.value)} placeholder="mg" maxLength="50" required /></label><label>Frequency<input value={item.frequency} onChange={(event) => updateItem(index, "frequency", event.target.value)} placeholder="Three times daily" maxLength="100" required /></label><label>Route<input value={item.route} onChange={(event) => updateItem(index, "route", event.target.value)} placeholder="Oral" maxLength="100" required /></label><label>Duration (days)<input inputMode="numeric" value={item.durationDays} onChange={(event) => updateItem(index, "durationDays", event.target.value)} placeholder="5" required /></label><label>Quantity<input inputMode="numeric" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} placeholder="15" required /></label><label className="composer-span-2">Instructions<textarea value={item.instructions} onChange={(event) => updateItem(index, "instructions", event.target.value)} placeholder="Optional instructions" maxLength="2000" /></label></div>{items.length > 1 && <button className="danger-button" type="button" onClick={() => removeItem(index)}>Remove medicine</button>}</fieldset>)}</div>{!createdPrescription && <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setItems((current) => [...current, EMPTY_PRESCRIPTION_ITEM()])}>Add medicine</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Creating…" : <>Create prescription <span aria-hidden="true">→</span></>}</button></div>}</form><aside className="composer-side-card"><span className="section-number">02</span><h2>Source image & next steps</h2><p>After creating the database record, attach the original prescription image. OCR assists review but never replaces the entered details or pharmacist decision.</p>{createdPrescription ? <><div className="created-record"><b>Prescription created</b><span>Status: {prettyLabel(createdPrescription.status)}</span><small>ID {createdPrescription.id}</small></div><label className="file-picker-label">Source image<input type="file" accept="image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>{file && <p className="selected-file">{file.name} · {formatFileSize(file.size)}</p>}<button className="primary-button rule-check-button" type="button" onClick={uploadSource} disabled={isUploading}>{isUploading ? <><span className="spinner" /> Uploading</> : <>Upload & read image <span aria-hidden="true">→</span></>}</button><button className="text-button composer-return" type="button" onClick={() => navigate("/pharmacist")}>Return to safety review →</button></> : <ol className="composer-steps"><li>Add the prescriber, issue date, and medicines.</li><li>Create the prescription database record.</li><li>Attach its image, run safety checks, then save a pharmacist decision.</li></ol>}</aside></div></section>;
}

const DASHBOARD_CONTENT = {
  patient: { label: "Patient workspace", title: "Your prescription information, in one place.", description: "Your allergy profile, reaction history, prescriptions, and pharmacist updates will appear here.", tasks: ["Keep allergy information current", "Review prescription status", "Read patient-friendly safety updates"], action: "View my profile", actionPath: "/patient" },
  pharmacist: { label: "Pharmacist workspace", title: "Start with the patient record.", description: "Search patients, verify prescription details, and complete an accountable review from one workspace.", tasks: ["Find a patient", "Review allergy and reaction history", "Read a prescription image"], action: "Start prescription review", actionPath: "/prescriptions/new" },
  doctor: { label: "Doctor workspace", title: "Review submitted prescription details.", description: "Create and review prescription information before it enters the pharmacist workflow.", tasks: ["Review recent prescriptions", "Upload a prescription image", "Check pharmacist feedback"], action: "Start prescription review", actionPath: "/prescriptions/new" },
  admin: { label: "Admin workspace", title: "Manage the MediTrace workspace.", description: "User administration, audit visibility, and database checks will be added in the admin module.", tasks: ["Manage user access", "Review audit activity", "Monitor prescription workflow"], action: "Open review workspace", actionPath: "/prescriptions/new" },
  auditor: { label: "Audit workspace", title: "Review accountable system activity.", description: "Audit records and read-only workflow evidence will be available here.", tasks: ["Review audit events", "Inspect review history", "Export coursework evidence"], action: "Return to overview", actionPath: "/" },
};

function RoleDashboard() {
  const { user } = useAuth();
  const content = DASHBOARD_CONTENT[user.role] || DASHBOARD_CONTENT.auditor;

  return <section className="dashboard-page page-width"><div className="dashboard-heading"><div><p className="eyebrow"><span /> {content.label}</p><h1>{content.title}</h1><p>{content.description}</p></div><div className="role-card"><small>Signed in as</small><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span><b>{user.role}</b></div></div><div className="dashboard-grid"><section className="dashboard-main"><span className="section-number">01</span><h2>Today’s starting point</h2><p>This protected dashboard confirms your account and role. The role-specific modules will add live patient, prescription, and audit data next.</p><Link className="primary-button" to={content.actionPath}>{content.action} <span aria-hidden="true">→</span></Link></section><section className="dashboard-tasks"><div className="card-heading"><span className="section-number">02</span><h3>Available next steps</h3></div>{content.tasks.map((task, index) => <div className="task-row" key={task}><span>{String(index + 1).padStart(2, "0")}</span><p>{task}</p><b>→</b></div>)}</section></div></section>;
}

function AdminModule() {
  const { session, user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadApplications() {
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/admin/pharmacist-applications`, { headers: { Authorization: `Bearer ${session.token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not load pharmacist access requests.");
      setApplications(data.applications || []);
    } catch (requestError) {
      setError(requestError.name === "TypeError" ? "Could not connect to MediTrace. Check that the backend is running." : requestError.message);
    } finally { setIsLoading(false); }
  }

  useEffect(() => { loadApplications(); }, []);

  async function decide(application, decision) {
    setWorkingId(application.userId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/api/admin/pharmacist-applications/${application.userId}/decision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update this request.");
      setNotice(data.message);
      await loadApplications();
    } catch (requestError) {
      setError(requestError.name === "TypeError" ? "Could not connect to MediTrace. Check that the backend is running." : requestError.message);
    } finally { setWorkingId(""); }
  }

  return <section className="admin-page page-width">
    <div className="admin-heading"><div><p className="eyebrow"><span /> Admin workspace</p><h1>Pharmacist access requests</h1><p>Review the applicant’s professional details and verify their license with the issuing authority before approving access.</p></div><div className="role-card"><small>Administrator</small><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span></div></div>
    {error && <div className="patient-message is-error" role="alert"><b>Could not complete request</b><span>{error}</span></div>}
    {notice && <div className="patient-message is-success" role="status"><b>Access review updated</b><span>{notice}</span></div>}
    <div className="admin-section-heading"><div><span className="section-number">01</span><h2>Pending applications</h2></div><button className="secondary-button" type="button" onClick={loadApplications} disabled={isLoading}>Refresh</button></div>
    {isLoading ? <div className="route-loading"><span className="spinner" /> Loading access requests…</div> : applications.length === 0 ? <div className="admin-empty"><strong>No pending pharmacist applications</strong><p>New requests will appear here for administrator review.</p></div> : <div className="admin-application-list">{applications.map((application) => <article className="admin-application-card" key={application.userId}>
      <div className="admin-application-header"><div><span className="record-tag">License review required</span><h3>{application.firstName} {application.lastName}</h3><a href={`mailto:${application.email}`}>{application.email}</a></div><time dateTime={application.createdAt}>Submitted {displayDate(application.createdAt)}</time></div>
      <dl className="admin-application-details"><div><dt>License number</dt><dd>{application.pharmacistLicenseNumber}</dd></div><div><dt>Organization</dt><dd>{application.pharmacistOrganization}</dd></div><div><dt>Phone</dt><dd>{application.phone || "Not provided"}</dd></div></dl>
      <div className="admin-application-actions"><button className="secondary-button" type="button" onClick={() => decide(application, "reject")} disabled={Boolean(workingId)}>{workingId === application.userId ? "Updating…" : "Reject request"}</button><button className="primary-button" type="button" onClick={() => decide(application, "approve")} disabled={Boolean(workingId)}>{workingId === application.userId ? "Updating…" : "Approve access"}</button></div>
    </article>)}</div>}
  </section>;
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><RoleDashboard /></ProtectedRoute>} />
        <Route path="/patient" element={<ProtectedRoute allowedRoles={["patient"]}><PatientModule /></ProtectedRoute>} />
        <Route path="/pharmacist" element={<ProtectedRoute allowedRoles={["pharmacist", "admin"]}><PharmacistModule /></ProtectedRoute>} />
        <Route path="/pharmacist/new-prescription" element={<ProtectedRoute allowedRoles={["pharmacist", "admin"]}><PrescriptionComposer /></ProtectedRoute>} />
        <Route path="/doctor" element={<ProtectedRoute allowedRoles={["doctor"]}><RoleDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminModule /></ProtectedRoute>} />
        <Route path="/prescriptions/new" element={<ProtectedRoute allowedRoles={["pharmacist", "doctor", "admin"]}><PrescriptionPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }
