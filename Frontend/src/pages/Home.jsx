import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Home.css";

// Reusable navbar logo (with "by Hamid Idrees" tag) — used on all pages
export function AccLogo({ onClick }) {
  return (
    <button className="navbar-logo" onClick={onClick}>
      <div className="logo-main">
        <span className="logo-text">ACC</span>
        <span className="logo-divider" />
        <span className="logo-tagline">Anonymous<br />Construction Co.</span>
      </div>
      <span className="logo-byline">by Hamid Idrees</span>
    </button>
  );
}

function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const navigate = useNavigate();
  const location = useLocation();

  // If we arrived from another page with a section to scroll to, do it
  useEffect(() => {
    if (location.state && location.state.scrollTo) {
      const id = location.state.scrollTo;
      // small delay so the page is rendered first
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth" });
        else window.scrollTo(0, 0);
      }, 100);
      // clear the state so it doesn't repeat on refresh
      window.history.replaceState({}, document.title);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  // Contact form state
  const [form, setForm] = useState({ name: "", phone: "", email: "", service: "", message: "" });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
      const sections = ["home", "about", "services", "projects", "contact"];
      const current = sections.find((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top <= 120 && rect.bottom >= 120;
      });
      if (current) setActiveSection(current);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    const els = document.querySelectorAll(".reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleFormChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleContactSubmit = () => {
    // Required: name, phone, service
    if (!form.name.trim() || !form.phone.trim() || !form.service.trim()) {
      setFormError("Please fill in your name, phone, and the service you need.");
      setFormSuccess("");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setFormError("");
    setFormSuccess("Thank you! Your message has been sent. We'll be in touch within 24 hours.");
    setForm({ name: "", phone: "", email: "", service: "", message: "" });
  };

  return (
    <div className="acc-site">
      {/* NAVBAR */}
      <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
        <div className="navbar-container">
          <AccLogo onClick={() => scrollTo("home")} />
          <nav className={`navbar-menu ${menuOpen ? "active" : ""}`}>
            <ul className="navbar-links">
              <li><span className={`nav-link ${activeSection === "home" ? "active" : ""}`} onClick={() => scrollTo("home")}>Home</span></li>
              <li><span className={`nav-link ${activeSection === "about" ? "active" : ""}`} onClick={() => scrollTo("about")}>About</span></li>
              <li><span className={`nav-link ${activeSection === "services" ? "active" : ""}`} onClick={() => scrollTo("services")}>Services</span></li>
              <li><span className={`nav-link ${activeSection === "projects" ? "active" : ""}`} onClick={() => scrollTo("projects")}>Projects</span></li>
              <li><span className={`nav-link ${activeSection === "contact" ? "active" : ""}`} onClick={() => scrollTo("contact")}>Contact Us</span></li>
            </ul>
          </nav>
          <div className="navbar-right">
            <button className="btn-login" onClick={() => navigate("/login")}>
              Login
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
            <button className="navbar-toggler" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu"><span /><span /><span /></button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section id="home" className="hero-section">
          {/* IMAGE: hero background ~1920x1080. In Home.css .hero-section set background-image: url('/images/hero.jpg') */}
          <div className="hero-overlay" />
          <div className="hero-content">
            <span className="hero-badge">Registered &amp; Licensed Contractor</span>
            <h1 className="hero-title">Constructing Dreams <span className="highlight">Into Reality</span></h1>
            <p className="hero-subtitle">Where quality meets craftsmanship</p>
            <p className="hero-description">From family homes to commercial landmarks, we bring honest work and lasting quality to every project we take on.</p>
            <div className="hero-buttons">
              <button className="btn-primary" onClick={() => scrollTo("contact")}>
                Book a Meeting
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </button>
              <button className="btn-secondary" onClick={() => scrollTo("projects")}>See Our Work</button>
            </div>
          </div>
        </section>

        {/* ABOUT (white) */}
        <section id="about" className="about-section">
          <div className="about-grid">
            <div className="about-visual reveal">
              {/* IMAGE: about photo ~700x500. In Home.css set .about-visual background-image */}
              <div className="about-visual-content">
                <div className="about-visual-year">15+</div>
                <div className="about-visual-text">Years of Excellence</div>
                <div className="about-visual-divider" />
                <p className="about-visual-tagline">Trusted by families and businesses across Pakistan since 2010</p>
              </div>
            </div>
            <div className="about-content reveal">
              <span className="section-tag">About Us</span>
              <h2>A Name Pakistan Builds With</h2>
              <p>What started as a small team in 2010 has grown into one of Pakistan's most trusted construction firms. We've delivered over 100 projects — from family homes to commercial complexes — and every single one carries the same promise: solid work, done right, on time.</p>
              <div className="about-points">
                <div className="about-point">
                  <div className="about-point-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></div>
                  <div><h4>100+ Projects Delivered</h4><p>Homes, offices, and infrastructure across the country</p></div>
                </div>
                <div className="about-point">
                  <div className="about-point-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
                  <div><h4>Safety &amp; Quality First</h4><p>Certified processes and skilled teams on every site</p></div>
                </div>
                <div className="about-point">
                  <div className="about-point-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
                  <div><h4>On Time, Every Time</h4><p>99% of our projects handed over on schedule</p></div>
                </div>
              </div>
              <Link to="/about" className="btn-text-link">
                Learn More About Us
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </Link>
            </div>
          </div>
        </section>

        {/* SERVICES (yellow) */}
        <section id="services" className="services-section">
          <div className="section-header reveal">
            <span className="section-tag">What We Do</span>
            <h2 className="section-title">Our Services</h2>
            <p className="section-subtitle">Whatever you're building, we've got you covered — start to finish</p>
          </div>
          <div className="services-grid">
            <div className="service-card reveal">
              <div className="service-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg></div>
              <h3>Residential Construction</h3>
              <p>From your first home to your dream house — we build living spaces that families grow in for generations.</p>
            </div>
            <div className="service-card reveal">
              <div className="service-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="9" x2="9" y2="9.01" /><line x1="15" y1="9" x2="15" y2="9.01" /><line x1="9" y1="13" x2="9" y2="13.01" /><line x1="15" y1="13" x2="15" y2="13.01" /></svg></div>
              <h3>Commercial Construction</h3>
              <p>Offices, plazas, and shopping centers designed to work as hard as you do — built for business and built to last.</p>
            </div>
            <div className="service-card reveal">
              <div className="service-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg></div>
              <h3>Renovation &amp; Remodeling</h3>
              <p>Breathe new life into your space. Whether it's a fresh look or a full rebuild, we handle it with care.</p>
            </div>
            <div className="service-card reveal">
              <div className="service-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20" /><path d="M4 20V8l8-5 8 5v12" /><path d="M9 20v-6h6v6" /></svg></div>
              <h3>Infrastructure</h3>
              <p>Roads, bridges, and underpasses. When the project is big and the stakes are high, we deliver with precision.</p>
            </div>
          </div>
        </section>

        {/* PROJECTS (white) */}
        <section id="projects" className="projects-section">
          <div className="section-header reveal">
            <span className="section-tag">Our Work</span>
            <h2 className="section-title">Projects We're Proud Of</h2>
            <p className="section-subtitle">Real projects, real results — here's a look at some of our finest work</p>
          </div>
          <div className="projects-grid">
            <div className="project-card reveal">
              {/* IMAGE: railway/engine shed project photo ~600x400. Set .project-card-image background-image */}
              <div className="project-card-image"><span className="project-card-badge">Infrastructure</span></div>
              <div className="project-card-body">
                <h3>Railway Engine Shed Facility</h3>
                <div className="project-card-location"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>Ghari Shahu, Lahore</div>
              </div>
            </div>
            <div className="project-card reveal">
              <div className="project-card-image"><span className="project-card-badge">Residential</span></div>
              <div className="project-card-body">
                <h3>Central Park Residences</h3>
                <div className="project-card-location"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>Central Park, Lahore</div>
              </div>
            </div>
            <div className="project-card reveal">
              <div className="project-card-image"><span className="project-card-badge">Commercial</span></div>
              <div className="project-card-body">
                <h3>ACC Serviced Apartments</h3>
                <div className="project-card-location"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>Gulberg, Lahore</div>
              </div>
            </div>
          </div>
          <div className="projects-cta reveal">
            <Link to="/projects" className="btn-primary">
              View All Projects
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </Link>
          </div>
        </section>

        {/* WHY US (yellow) */}
        <section className="why-us-section why-us-cream">
          <div className="section-header reveal">
            <span className="section-tag">Why Choose Us</span>
            <h2 className="section-title">Built on Trust &amp; Quality</h2>
            <p className="section-subtitle">The values behind every project we take on</p>
          </div>
          <div className="values-grid">
            <div className="value-card reveal">
              <div className="value-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg></div>
              <h3>Quality</h3>
              <p>We don't cut corners. From the foundation to the final coat, it's done properly.</p>
            </div>
            <div className="value-card reveal">
              <div className="value-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></div>
              <h3>Trust</h3>
              <p>Clear pricing, honest timelines, and no surprises. That's how we work.</p>
            </div>
            <div className="value-card reveal">
              <div className="value-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></svg></div>
              <h3>Experience</h3>
              <p>15+ years and 100+ projects. We've seen it, solved it, and built it before.</p>
            </div>
            <div className="value-card reveal">
              <div className="value-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
              <h3>Safety</h3>
              <p>Every worker goes home safe. On our sites, safety is never optional.</p>
            </div>
          </div>
        </section>

        {/* CONTACT (white) */}
        <section id="contact" className="contact-section">
          <div className="contact-wrapper">
            <div className="contact-left">
              <div className="contact-left-content">
                <span className="login-tag">Get In Touch</span>
                <h2>Let's Build <span>Something Great</span></h2>
                <p>Have a project in mind? Tell us about it. Our team will get back to you within 24 hours.</p>
                <ul className="contact-info-list">
                  <li className="contact-info-item">
                    <div className="contact-info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg></div>
                    <div><strong>Visit Us</strong>Lahore, Pakistan</div>
                  </li>
                  <li className="contact-info-item">
                    <div className="contact-info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg></div>
                    <div><strong>Call Us</strong>+92 300 1234567</div>
                  </li>
                  <li className="contact-info-item">
                    <div className="contact-info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg></div>
                    <div><strong>Email Us</strong>info@acc.com.pk</div>
                  </li>
                </ul>
              </div>
            </div>
            <div className="contact-right">
              <div className="contact-form-header">
                <h3>Send Us a Message</h3>
                <p>Fill out the form and we'll be in touch shortly</p>
              </div>
              <div className={`contact-form ${shake ? "shake" : ""}`}>
                {formError && (
                  <div className="login-msg-box login-msg-error" style={{ display: "flex" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <span>{formError}</span>
                  </div>
                )}
                {formSuccess && (
                  <div className="login-msg-box login-msg-success" style={{ display: "flex" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    <span>{formSuccess}</span>
                  </div>
                )}
                <div className="contact-form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name <span className="req">*</span></label>
                    <input type="text" className="form-input" placeholder="Your name" value={form.name} onChange={(e) => handleFormChange("name", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone <span className="req">*</span></label>
                    <input type="text" className="form-input" placeholder="+92 300 0000000" value={form.phone} onChange={(e) => handleFormChange("phone", e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={(e) => handleFormChange("email", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Service Needed <span className="req">*</span></label>
                  <select className="form-input" value={form.service} onChange={(e) => handleFormChange("service", e.target.value)}>
                    <option value="">Select a service</option>
                    <option>Residential Construction</option>
                    <option>Commercial Construction</option>
                    <option>Renovation &amp; Remodeling</option>
                    <option>Infrastructure</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Your Message</label>
                  <textarea className="form-input contact-textarea" placeholder="Tell us about your project..." rows="3" value={form.message} onChange={(e) => handleFormChange("message", e.target.value)}></textarea>
                </div>
                <button type="button" className="btn-submit" onClick={handleContactSubmit}>
                  Send Message
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER (dark) */}
        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-brand">
              <span className="logo-text">ACC</span>
              <div className="footer-company">Anonymous Construction Co.</div>
              <p>Pakistan's trusted construction partner since 2010. We build homes, commercial spaces, and infrastructure that stand the test of time — with honesty, quality, and craftsmanship in every project.</p>
              <Link to="/privacy" className="footer-privacy-link">Privacy Policy</Link>
            </div>
            <ul className="footer-contact">
              <li className="footer-contact-item">
                <div className="footer-contact-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg></div>
                <div><strong>Head Office</strong>Lahore, Pakistan</div>
              </li>
              <li className="footer-contact-item">
                <div className="footer-contact-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg></div>
                <div><strong>Contact</strong>+92 300 1234567</div>
              </li>
              <li className="footer-contact-item">
                <div className="footer-contact-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg></div>
                <div><strong>Email</strong>info@acc.com.pk</div>
              </li>
            </ul>
          </div>
          <div className="footer-bottom">
            <div>&copy; 2026 Anonymous Construction Co. All rights reserved.</div>
            <div className="footer-links">Built by <a href="https://github.com/Hamid-Idrees-7" target="_blank" rel="noopener noreferrer">Hamid Idrees</a></div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default Home;
