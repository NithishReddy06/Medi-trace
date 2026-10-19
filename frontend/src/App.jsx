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
    <div className="login-intro"><p className="eyebrow"><span /> Secure workspace</p><h1>Sign in to continue your review.</h1><p>Access is assigned by role. Your dashboard and available actions are based on your MediTrace account.</p><div className="login-assurance"><span>✓ Bcrypt password verification</span><span>✓ Time-limited JWT session</span><span>✓ Role-based API access</span></div></div>
    <form className="login-card" onSubmit={handleSubmit} noValidate>
      <div className="login-card-heading"><span className="section-number">01</span><div><p className="eyebrow"><span /> Account access</p><h2>Welcome back</h2></div></div>
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "login-error" : undefined} placeholder="you@example.test" disabled={isSubmitting} />
      <label htmlFor="password">Password</label>
      <div className="password-field"><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "login-error" : undefined} placeholder="Enter your password" disabled={isSubmitting} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={isSubmitting}>{showPassword ? "Hide" : "Show"}</button></div>
      {error && <div className="login-error" id="login-error" role="alert"><b>Sign-in failed</b><p>{error}</p></div>}
      <button className="primary-button login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="spinner" /> Signing in</> : <>Sign in securely <span aria-hidden="true">→</span></>}</button>
      <div className="demo-access"><strong>Coursework demo account</strong><p><code>noah.pharmacist@example.test</code></p><p>Password: <code>DemoPass123!</code></p></div>
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

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><RoleDashboard /></ProtectedRoute>} />
        <Route path="/patient" element={<ProtectedRoute allowedRoles={["patient"]}><PatientModule /></ProtectedRoute>} />
        <Route path="/pharmacist" element={<ProtectedRoute allowedRoles={["pharmacist"]}><RoleDashboard /></ProtectedRoute>} />
        <Route path="/doctor" element={<ProtectedRoute allowedRoles={["doctor"]}><RoleDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><RoleDashboard /></ProtectedRoute>} />
        <Route path="/prescriptions/new" element={<ProtectedRoute allowedRoles={["pharmacist", "doctor", "admin"]}><PrescriptionPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }
