import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AccLogo } from "./Home";
import "./Home.css";

function Privacy() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Open at top instantly
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Go to home, then scroll to a specific section
  const goToSection = (sectionId) => {
    setMenuOpen(false);
    navigate("/", { state: { scrollTo: sectionId } });
  };

  return (
    <div className="acc-site">
      <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
        <div className="navbar-container">
          <AccLogo onClick={() => goToSection("home")} />
          <nav className={`navbar-menu ${menuOpen ? "active" : ""}`}>
            <ul className="navbar-links">
              <li><span className="nav-link" onClick={() => goToSection("home")}>Home</span></li>
              <li><span className="nav-link" onClick={() => goToSection("about")}>About</span></li>
              <li><span className="nav-link" onClick={() => goToSection("services")}>Services</span></li>
              <li><span className="nav-link" onClick={() => goToSection("projects")}>Projects</span></li>
              <li><span className="nav-link" onClick={() => goToSection("contact")}>Contact Us</span></li>
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
        <section className="privacy-section">
          <div className="privacy-container">
            <div className="privacy-header">
              <span className="section-tag">Legal Information</span>
              <h1 className="privacy-title">Privacy Policy</h1>
              <p className="privacy-subtitle">Last updated: January 2026</p>
            </div>

            <div className="privacy-content">
              <div className="privacy-intro">
                <p>At Anonymous Construction Co., we respect your privacy and are committed to protecting any personal information you share with us. This Privacy Policy explains what information we collect through our website and services, how we use it, and how we keep it safe.</p>
                <p>By using our website or contacting us for construction services, you agree to the practices described in this policy.</p>
              </div>

              <div className="privacy-block">
                <h2>1. Information We Collect</h2>
                <p>When you interact with us — through our contact form, a quote request, or a direct inquiry — we may collect:</p>
                <ul>
                  <li><strong>Contact Details:</strong> Your name, phone number, and email address</li>
                  <li><strong>Project Information:</strong> Details about the construction or renovation work you're interested in</li>
                  <li><strong>Communication Records:</strong> Messages, quotes, and correspondence exchanged with our team</li>
                  <li><strong>Website Data:</strong> Basic technical information such as browser type and pages visited</li>
                </ul>
              </div>

              <div className="privacy-block">
                <h2>2. How We Use Your Information</h2>
                <p>We use the information you provide only for legitimate business purposes, including:</p>
                <ul>
                  <li>Responding to your inquiries and preparing project quotes</li>
                  <li>Scheduling meetings and site visits</li>
                  <li>Managing and delivering your construction project</li>
                  <li>Keeping you updated on your project's progress</li>
                  <li>Improving our services and website experience</li>
                </ul>
              </div>

              <div className="privacy-block">
                <h2>3. How We Protect Your Data</h2>
                <p>We take reasonable measures to keep your information secure:</p>
                <ul>
                  <li><strong>Secure Storage:</strong> Client information is stored in protected systems with restricted access</li>
                  <li><strong>Limited Access:</strong> Only authorized team members can view your details</li>
                  <li><strong>Secure Connections:</strong> Our website uses HTTPS encryption to protect data in transit</li>
                  <li><strong>No Unnecessary Retention:</strong> We keep your data only as long as needed for your project and legal requirements</li>
                </ul>
              </div>

              <div className="privacy-block">
                <h2>4. Information Sharing</h2>
                <p>We <strong>do not sell or rent</strong> your personal information to anyone. We only share your details in limited situations:</p>
                <ul>
                  <li>With trusted subcontractors or suppliers directly involved in your project</li>
                  <li>When required by Pakistani law or a valid legal request</li>
                  <li>To protect the rights, safety, or property of our company and clients</li>
                </ul>
              </div>

              <div className="privacy-block">
                <h2>5. Your Rights</h2>
                <p>You have the right to:</p>
                <ul>
                  <li><strong>Access</strong> the personal information we hold about you</li>
                  <li><strong>Request corrections</strong> to any inaccurate details</li>
                  <li><strong>Ask us to delete</strong> your information, subject to legal obligations</li>
                  <li><strong>Opt out</strong> of marketing communications at any time</li>
                </ul>
              </div>

              <div className="privacy-block">
                <h2>6. Cookies &amp; Website Data</h2>
                <p>Our website may use basic cookies to improve your browsing experience and understand how visitors use our site. You can disable cookies in your browser settings, though some features may not work as intended.</p>
              </div>

              <div className="privacy-block">
                <h2>7. Third-Party Links</h2>
                <p>Our website may contain links to external sites. We are not responsible for the privacy practices of those websites, and we encourage you to review their policies separately.</p>
              </div>

              <div className="privacy-block">
                <h2>8. Changes to This Policy</h2>
                <p>We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. Any updates will be posted on this page with a revised date. We encourage you to review it periodically.</p>
              </div>

              <div className="privacy-contact">
                <h2>Questions About Your Privacy?</h2>
                <p>If you have any questions or concerns about this Privacy Policy or how we handle your information, please get in touch:</p>
                <div className="privacy-contact-info">
                  <p><strong>Anonymous Construction Co.</strong></p>
                  <p>Email: info@acc.com.pk</p>
                  <p>Phone: +92 300 1234567</p>
                  <p>Office: Lahore, Pakistan</p>
                </div>
              </div>

              <div className="privacy-back">
                <button className="btn-primary" onClick={() => goToSection("home")}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Privacy;
