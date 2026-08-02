import React, { useState } from 'react'

// Point this at your deployed Flask API (EC2 public DNS / domain).
// Falls back to a local demo estimate if the API isn't reachable yet,
// so the frontend is fully explorable before the backend is deployed.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/predict'

const initialForm = {
  age: '',
  gender: 'Female',
  heightCm: '',
  weightKg: '',
  systolic: '',
  diastolic: '',
  cholesterol: '',
  smoker: 'No',
  exerciseDays: '3',
  familyHistory: 'No',
}

function localEstimate(f) {
  const age = Number(f.age) || 0
  const h = (Number(f.heightCm) || 0) / 100
  const w = Number(f.weightKg) || 0
  const bmi = h > 0 ? w / (h * h) : 0
  const systolic = Number(f.systolic) || 0
  const cholesterol = Number(f.cholesterol) || 0
  const exerciseDays = Number(f.exerciseDays) || 0

  let score = 0
  const factors = []

  if (age > 55) { score += 16; factors.push(['Age', 'high']) }
  else if (age > 40) { score += 8; factors.push(['Age', 'mid']) }
  else { factors.push(['Age', 'low']) }

  if (bmi > 30) { score += 20; factors.push(['BMI', 'high']) }
  else if (bmi > 25) { score += 10; factors.push(['BMI', 'mid']) }
  else { factors.push(['BMI', 'low']) }

  if (systolic > 140) { score += 20; factors.push(['Blood pressure', 'high']) }
  else if (systolic > 120) { score += 10; factors.push(['Blood pressure', 'mid']) }
  else { factors.push(['Blood pressure', 'low']) }

  if (cholesterol > 240) { score += 18; factors.push(['Cholesterol', 'high']) }
  else if (cholesterol > 200) { score += 9; factors.push(['Cholesterol', 'mid']) }
  else { factors.push(['Cholesterol', 'low']) }

  if (f.smoker === 'Yes') { score += 14; factors.push(['Smoking', 'high']) }
  else { factors.push(['Smoking', 'low']) }

  if (exerciseDays < 2) { score += 10; factors.push(['Activity level', 'mid']) }
  else { factors.push(['Activity level', 'low']) }

  if (f.familyHistory === 'Yes') { score += 12; factors.push(['Family history', 'mid']) }
  else { factors.push(['Family history', 'low']) }

  score = Math.max(2, Math.min(98, score))
  return { risk: Math.round(score), factors, source: 'demo' }
}

function categoryFor(score) {
  if (score < 34) return { label: 'Low risk', tone: 'low', color: 'var(--accent-vital)' }
  if (score < 67) return { label: 'Moderate risk', tone: 'mid', color: 'var(--accent-warm)' }
  return { label: 'Elevated risk', tone: 'high', color: 'var(--accent-danger)' }
}

function Gauge({ score }) {
  const r = 90
  const cx = 110
  const cy = 120
  const circumference = Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - pct / 100)
  const cat = categoryFor(pct)

  const angleDeg = 180 - (pct / 100) * 180
  const rad = (angleDeg * Math.PI) / 180
  const needleLen = 76
  const nx = cx + needleLen * Math.cos(rad)
  const ny = cy - needleLen * Math.sin(rad)

  return (
    <svg viewBox="0 0 220 132" width="240" height="145">
      <path
        d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`}
        fill="none"
        stroke="var(--hairline)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`}
        fill="none"
        stroke={cat.color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
      />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="var(--text-primary)" />
    </svg>
  )
}

export default function App() {
  const [form, setForm] = useState(initialForm)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setToggle = (key, value) => () => setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('API responded with an error')
      const data = await res.json()
      setResult({ risk: data.risk, factors: data.factors || [], source: 'api' })
    } catch (err) {
      setError('Backend not reachable — showing a local demo estimate instead.')
      setResult(localEstimate(form))
    } finally {
      setLoading(false)
      setTimeout(() => {
        document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }

  const cat = result ? categoryFor(result.risk) : null

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <a className="brand" href="#top">
            <span className="brand-dot" />
            VITALS&nbsp;CHECK
          </a>
          <div className="nav-links">
            <a href="#assessment">Assessment</a>
            <a href="#about">About</a>
          </div>
        </div>
      </nav>

      <div className="wrap" id="top">
        <section className="hero">
          <div>
            <div className="eyebrow">AI-Assisted Screening</div>
            <h1>Know your risk<br /><em>before</em> it becomes a diagnosis.</h1>
            <p className="lead">
              Enter a short set of vitals and lifestyle details. The model reads them the way a
              clinician scans a chart — flagging what's elevated, what's steady, and what's worth
              watching.
            </p>
            <div className="cta-row">
              <a className="btn-primary" href="#assessment" style={{ textDecoration: 'none' }}>Start assessment</a>
              <a className="btn-ghost" href="#about">How it works</a>
            </div>
          </div>

          <div className="hero-scope">
            <div className="scope-label">
              <span>LEAD II — LIVE TRACE</span>
              <span className="live">● MONITORING</span>
            </div>
            <svg className="ecg-svg" viewBox="0 0 340 120" preserveAspectRatio="none">
              <line x1="0" y1="60" x2="340" y2="60" className="ecg-baseline" />
              <path
                className="ecg-path"
                d="M0,60 L36,60 L50,60 L58,30 L66,95 L74,15 L82,60 L100,60 L136,60 L150,60 L158,30 L166,95 L174,15 L182,60 L200,60 L236,60 L250,60 L258,30 L266,95 L274,15 L282,60 L300,60 L336,60 L340,60"
              />
            </svg>
          </div>
        </section>

        <section id="assessment">
          <div className="section-head">
            <h2>Health assessment</h2>
            <p>All fields stay in your browser until you submit — nothing is stored without your action.</p>
          </div>

          <form className="panel" onSubmit={handleSubmit}>
            <div className="panel-header">
              <span>PATIENT INTAKE</span>
              <span>FORM 01</span>
            </div>
            <div className="panel-body">

              <div className="field-group">
                <h3>Demographics</h3>
                <div className="field-grid">
                  <div className="field">
                    <label>Age <span className="unit">years</span></label>
                    <input type="number" min="1" max="120" required value={form.age} onChange={update('age')} />
                  </div>
                  <div className="field">
                    <label>Gender</label>
                    <select value={form.gender} onChange={update('gender')}>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="field-group">
                <h3>Vitals</h3>
                <div className="field-grid">
                  <div className="field">
                    <label>Height <span className="unit">cm</span></label>
                    <input type="number" min="50" max="250" required value={form.heightCm} onChange={update('heightCm')} />
                  </div>
                  <div className="field">
                    <label>Weight <span className="unit">kg</span></label>
                    <input type="number" min="20" max="300" required value={form.weightKg} onChange={update('weightKg')} />
                  </div>
                  <div className="field">
                    <label>Systolic BP <span className="unit">mmHg</span></label>
                    <input type="number" min="70" max="260" required value={form.systolic} onChange={update('systolic')} />
                  </div>
                  <div className="field">
                    <label>Diastolic BP <span className="unit">mmHg</span></label>
                    <input type="number" min="40" max="160" required value={form.diastolic} onChange={update('diastolic')} />
                  </div>
                  <div className="field full">
                    <label>Total cholesterol <span className="unit">mg/dL</span></label>
                    <input type="number" min="100" max="400" required value={form.cholesterol} onChange={update('cholesterol')} />
                  </div>
                </div>
              </div>

              <div className="field-group">
                <h3>Lifestyle</h3>
                <div className="field-grid">
                  <div className="field">
                    <label>Smoker</label>
                    <div className="toggle-row">
                      <button type="button" className={`toggle-btn ${form.smoker === 'No' ? 'active' : ''}`} onClick={setToggle('smoker', 'No')}>No</button>
                      <button type="button" className={`toggle-btn ${form.smoker === 'Yes' ? 'active' : ''}`} onClick={setToggle('smoker', 'Yes')}>Yes</button>
                    </div>
                  </div>
                  <div className="field">
                    <label>Family history <span className="unit">cardiac / metabolic</span></label>
                    <div className="toggle-row">
                      <button type="button" className={`toggle-btn ${form.familyHistory === 'No' ? 'active' : ''}`} onClick={setToggle('familyHistory', 'No')}>No</button>
                      <button type="button" className={`toggle-btn ${form.familyHistory === 'Yes' ? 'active' : ''}`} onClick={setToggle('familyHistory', 'Yes')}>Yes</button>
                    </div>
                  </div>
                  <div className="field full">
                    <label>Exercise <span className="unit">days / week</span></label>
                    <input type="number" min="0" max="7" required value={form.exerciseDays} onChange={update('exerciseDays')} />
                  </div>
                </div>
              </div>

              <div className="form-footer">
                <div className="form-note">
                  Educational demo project — not a substitute for professional medical advice or diagnosis.
                </div>
                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Analyzing…' : 'Run assessment'}
                </button>
              </div>
              {error && <div className="error-note">{error}</div>}
            </div>
          </form>
        </section>

        {result && (
          <section id="result">
            <div className="section-head">
              <h2>Assessment result</h2>
              <p>Based on the values you entered — {result.source === 'api' ? 'scored by the deployed model.' : 'a local demo estimate, since the API isn\u2019t connected yet.'}</p>
            </div>
            <div className="panel">
              <div className="panel-header">
                <span>READOUT</span>
                <span>{result.source === 'api' ? 'LIVE MODEL' : 'DEMO ESTIMATE'}</span>
              </div>
              <div className="result-grid">
                <div className="gauge-side">
                  <Gauge score={result.risk} />
                  <div className="gauge-score" style={{ color: cat.color }}>{result.risk}%</div>
                  <div className="gauge-category" style={{ color: cat.color }}>{cat.label}</div>
                </div>
                <div className="detail-side">
                  <h3>What's driving this score</h3>
                  <p>
                    These are the inputs that moved the needle most. Address the highlighted ones
                    first — they carry the most weight in the model.
                  </p>
                  <ul className="factor-list">
                    {result.factors.map(([name, tone], i) => (
                      <li key={i}>
                        <span>{name}</span>
                        <span className={`tag ${tone}`}>{tone}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="disclaimer">
                    This tool provides a statistical estimate for portfolio/demo purposes only. It is not
                    a diagnosis. Please consult a licensed physician for medical concerns.
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="about">
          <div className="section-head">
            <h2>How it works</h2>
            <p>A small, honestly-labeled pipeline — built to show the full stack, not hide it.</p>
          </div>
          <div className="field-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="panel" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-vital)', margin: '0 0 10px', letterSpacing: '0.08em' }}>INPUT</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0, lineHeight: 1.6 }}>You submit vitals through this form — nothing leaves your browser until you press Run.</p>
            </div>
            <div className="panel" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-vital)', margin: '0 0 10px', letterSpacing: '0.08em' }}>MODEL</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0, lineHeight: 1.6 }}>A Flask API on AWS EC2 runs a scikit-learn classifier and returns a risk score with RDS-backed logging.</p>
            </div>
            <div className="panel" style={{ padding: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-vital)', margin: '0 0 10px', letterSpacing: '0.08em' }}>OUTPUT</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0, lineHeight: 1.6 }}>The gauge above renders instantly, with the factors that most influenced your result.</p>
            </div>
          </div>
        </section>

        <footer>
          <div className="footer-inner">
            <div className="stack-badges">
              <span className="badge">React</span>
              <span className="badge">Flask</span>
              <span className="badge">AWS EC2</span>
              <span className="badge">RDS</span>
              <span className="badge">S3</span>
              <span className="badge">CloudFront</span>
            </div>
            <div className="footer-copy">Vitals Check — student portfolio project</div>
          </div>
        </footer>
      </div>
    </>
  )
}
