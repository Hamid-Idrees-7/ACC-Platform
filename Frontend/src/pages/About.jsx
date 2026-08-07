import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AccLogo } from "./Home";
import "./Home.css";
import "./About.css";

function About() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const navigate = useNavigate();

  const testimonials = [
    { initial: "U", name: "Umair", project: "Commercial Office, Gulberg", text: "ACC built our office in Gulberg and the experience was excellent from day one. Professional team, clear communication, and they finished exactly on schedule." },
    { initial: "M", name: "Muzammil", project: "1 Kanal Luxury Home, Lahore", text: "They built my 1 kanal house and I couldn't be happier. The attention to detail and quality of finishing is exactly what they promised. Highly recommended." },
    { initial: "A", name: "Ali", project: "Luxury Farmhouse", text: "Our farmhouse turned out even better than we imagined. ACC understood our vision and delivered it with real craftsmanship. A team you can trust." },
    { initial: "PR", name: "Pakistan Railways", project: "Diesel Engine Shed Reconstruction", text: "ACC handled the reconstruction of our engine shed facility with the professionalism a project of this scale demands. Delivered to specification, on time.", official: true },
    { initial: "UBL", name: "United Bank Limited", project: "Branch Construction, Lahore", text: "ACC delivered our new branch to the exact standards a bank requires — quality finishing, strict timelines, and full compliance. A reliable construction partner.", official: true },
  ];

  const perPage = 4;
  const maxIndex = Math.max(0, testimonials.length - perPage);
  const nextTestimonials = () => setTestimonialIndex((i) => Math.min(i + 1, maxIndex));
  const prevTestimonials = () => setTestimonialIndex((i) => Math.max(i - 1, 0));

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const handleScroll = () => setScrolled(window.scrollY > 30);
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

  const goToSection = (sectionId) => {
    setMenuOpen(false);
    navigate("/", { state: { scrollTo: sectionId } });
  };

  return (
    <div className="acc-site">
      {/* NAVBAR */}
      <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
        <div className="navbar-container">
          <AccLogo onClick={() => goToSection("home")} />
          <nav className={`navbar-menu ${menuOpen ? "active" : ""}`}>
            <ul className="navbar-links">
              <li><span className="nav-link" onClick={() => goToSection("home")}>Home</span></li>
              <li><span className="nav-link active" onClick={() => goToSection("about")}>About</span></li>
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
        {/* PAGE HERO */}
        <section className="about-hero">
          <div className="about-hero-overlay" />
          <div className="about-hero-content">
            <span className="hero-badge">Our Story</span>
            <h1>Building More Than Structures — Building Trust</h1>
            <p>From a small team with big dreams to one of the country's most trusted construction firms — here's how it all began.</p>
          </div>
        </section>

        {/* OUR STORY */}
        <section className="about-story-section">
          <div className="about-story-grid">
            <div className="about-story-visual reveal" style={{ backgroundImage: "url('/images/founder-story.jpg')" }}>
              <div className="about-story-badge">
                <span className="about-story-badge-year">Est. 2010</span>
                <span className="about-story-badge-text">Lahore, Pakistan</span>
              </div>
            </div>
            <div className="about-story-content reveal">
              <span className="section-tag">How It Started</span>
              <h2>A Vision Built on Trust</h2>
              <p>
                Anonymous Construction Co. was founded in 2010 by <strong>Hamid Idrees</strong>,
                a civil engineer with a simple belief: construction should be honest, reliable,
                and built to last. What began as a small team taking on residential projects in
                Lahore has grown into a full-scale construction firm trusted across Pakistan.
              </p>
              <p>
                In the early years, we took on whatever came our way — small homes, boundary
                walls, renovations. But we did every job as if it were our own. Word spread. One
                satisfied family told another. A shop owner recommended us to a friend building an
                office. That's how we grew: not through big marketing, but through the quality of
                our work and the trust of the people we served.
              </p>
              <p>
                Today, with over 100 completed projects and a team of 50+ skilled professionals,
                that founding belief hasn't changed. Every project — big or small — still gets the
                same care, honesty, and craftsmanship we started with.
              </p>
            </div>
          </div>
        </section>

        {/* MISSION & VISION */}
        <section className="about-mv-section">
          <div className="about-mv-grid">
            <div className="about-mv-card reveal">
              <div className="about-mv-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
              </div>
              <h3>Our Mission</h3>
              <p>To deliver construction projects that exceed expectations — combining quality craftsmanship, honest pricing, and on-time delivery, while treating every client's project as our own.</p>
            </div>
            <div className="about-mv-card reveal">
              <div className="about-mv-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              </div>
              <h3>Our Vision</h3>
              <p>To become Pakistan's most trusted name in construction — known not just for the structures we build, but for the relationships, integrity, and standards we bring to every project.</p>
            </div>
          </div>
        </section>

        {/* TEAM */}
        <section className="about-team-section">
          <div className="section-header reveal">
            <span className="section-tag">Meet the Team</span>
            <h2 className="section-title">The People Behind ACC</h2>
            <p className="section-subtitle">Skilled professionals who bring every project to life</p>
          </div>

          {/* Founder - featured, bigger */}
          <div className="team-founder reveal">
            <div className="team-founder-photo" style={{ backgroundImage: "url('/images/hamid.jpg')" }}></div>
            <div className="team-founder-info">
              <span className="team-founder-tag">Founder</span>
              <h3>Hamid Idrees</h3>
              <p className="team-role">Founder &amp; Civil Engineer</p>
              <p className="team-desc">
                A civil engineer by profession and the visionary behind ACC. Hamid founded the
                company in 2010 with a commitment to honest, quality construction. He leads the
                company's overall direction and engineering standards on every project.
              </p>
            </div>
          </div>

          {/* Civil engineers - two cards */}
          <div className="team-grid team-grid-two">
            <div className="team-card reveal">
              <div className="team-card-photo" style={{ backgroundImage: "url('/images/hassan.jpg')" }}></div>
              <div className="team-card-info">
                <h4>Hassan</h4>
                <p className="team-role">Civil Engineer</p>
                <p className="team-desc">Handles on-site execution and structural work, making sure every build meets our engineering standards.</p>
              </div>
            </div>
            <div className="team-card reveal">
              <div className="team-card-photo" style={{ backgroundImage: "url('/images/bilal.jpg')" }}></div>
              <div className="team-card-info">
                <h4>Bilal</h4>
                <p className="team-role">Civil Engineer</p>
                <p className="team-desc">Focuses on quality control and site supervision, ensuring precision and safety across all our projects.</p>
              </div>
            </div>
          </div>

          {/* Architect - special wide card */}
          <div className="team-architect reveal">
            <div className="team-architect-photo" style={{ backgroundImage: "url('/images/faseeha.jpg')" }}></div>
            <div className="team-architect-info">
              <span className="team-architect-tag">Lead Architect</span>
              <h3>Faseeha</h3>
              <p className="team-role">Architect &amp; Project Manager</p>
              <p className="team-desc">
                Faseeha is the creative force behind ACC's designs. Trained in architecture in Italy,
                she brings an international eye for detail, blending modern aesthetics with practical,
                build-ready plans. From the first sketch to the final walkthrough, she manages projects
                end to end — turning ideas into structures our clients are proud to call their own.
              </p>
              <ul className="team-architect-points">
                <li>Internationally trained in architectural design</li>
                <li>Leads design and project management</li>
                <li>Specializes in modern residential &amp; commercial spaces</li>
              </ul>
            </div>
          </div>
        </section>

        {/* TIMELINE */}
        <section className="about-timeline-section">
          <div className="section-header reveal">
            <span className="section-tag">Our Journey</span>
            <h2 className="section-title">15 Years of Growth</h2>
            <p className="section-subtitle">Key milestones that shaped who we are today</p>
          </div>

          <div className="timeline">
            {[
              { year: "2010", title: "The Beginning", text: "Hamid Idrees founds Anonymous Construction Co. in Lahore, starting with small residential projects." },
              { year: "2013", title: "First Big Contract", text: "Completed our first major residential complex, establishing our reputation for quality and reliability." },
              { year: "2016", title: "Going Commercial", text: "Expanded into commercial construction — offices, plazas, and business centers across Punjab." },
              { year: "2019", title: "Infrastructure Projects", text: "Took on our first large-scale infrastructure work, including road and underpass projects." },
              { year: "2022", title: "100+ Projects", text: "Crossed the milestone of 100 completed projects, with a growing team of skilled professionals." },
              { year: "2026", title: "Building the Future", text: "Now a full-scale construction firm, embracing modern technology and an integrated management system." },
            ].map((m, i) => (
              <div className={`timeline-item reveal ${i % 2 === 0 ? "left" : "right"}`} key={i}>
                <div className="timeline-content">
                  <span className="timeline-year">{m.year}</span>
                  <h4>{m.title}</h4>
                  <p>{m.text}</p>
                </div>
                <div className="timeline-dot" />
              </div>
            ))}
          </div>
        </section>

        {/* CERTIFICATIONS */}
        <section className="about-certs-section">
          <div className="section-header reveal">
            <span className="section-tag">Credentials</span>
            <h2 className="section-title">Registered &amp; Certified</h2>
            <p className="section-subtitle">Officially recognized and compliant with industry standards</p>
          </div>

          <div className="certs-grid">
            {[
              { title: "PEC Registered", sub: "Pakistan Engineering Council", icon: <><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></> },
              { title: "SECP Registered", sub: "Securities & Exchange Commission", icon: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></> },
              { title: "Chamber of Commerce", sub: "Lahore Chamber Member", icon: <><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></> },
              { title: "ISO 9001:2015", sub: "Quality Management Certified", icon: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></> },
            ].map((c, i) => (
              <div className="cert-card reveal" key={i}>
                <div className="cert-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
                </div>
                <h4>{c.title}</h4>
                <p>{c.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="about-testimonials-section">
          <div className="section-header reveal">
            <span className="section-tag">Client Voices</span>
            <h2 className="section-title">What Our Clients Say</h2>
            <p className="section-subtitle">Trust, earned one project at a time</p>
          </div>

          <div className="testimonials-slider">
            <button
              className="testimonial-arrow prev"
              onClick={prevTestimonials}
              disabled={testimonialIndex === 0}
              aria-label="Previous"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>

            <div className="testimonials-viewport">
              <div
                className="testimonials-track"
                style={{ transform: `translateX(calc(-${testimonialIndex} * (100% / ${perPage})))` }}
              >
                {testimonials.map((t, i) => (
                  <div className="testimonial-card" key={i}>
                    <div className="testimonial-quote">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.571-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z" /></svg>
                    </div>
                    <p className="testimonial-text">{t.text}</p>
                    <div className="testimonial-author">
                      <div className={`testimonial-avatar ${t.official ? "official" : ""}`}>
                        <span>{t.initial}</span>
                      </div>
                      <div className="testimonial-author-info">
                        <strong>{t.name}</strong>
                        <span>{t.project}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="testimonial-arrow next"
              onClick={nextTestimonials}
              disabled={testimonialIndex >= maxIndex}
              aria-label="Next"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          <div className="testimonials-dots">
            {Array.from({ length: maxIndex + 1 }).map((_, i) => (
              <button
                key={i}
                className={`testimonial-dot ${i === testimonialIndex ? "active" : ""}`}
                onClick={() => setTestimonialIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </section>

        {/* STATS */}
        <section className="about-stats-section">
          <div className="about-stats-grid">
            {[
              { num: "15+", label: "Years of Experience" },
              { num: "100+", label: "Projects Completed" },
              { num: "50+", label: "Skilled Professionals" },
              { num: "99%", label: "On-Time Delivery" },
            ].map((s, i) => (
              <div className="about-stat reveal" key={i}>
                <div className="about-stat-num">{s.num}</div>
                <div className="about-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="about-cta-section">
          <div className="about-cta-content reveal">
            <h2>Let's Build Something Together</h2>
            <p>Whether it's your dream home or your next commercial venture, we'd love to be part of it.</p>
            <button className="btn-primary btn-large" onClick={() => goToSection("contact")}>
              Get in Touch
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-brand">
              <span className="logo-text">ACC</span>
              <div className="footer-company">Anonymous Construction Co.</div>
              <p>Pakistan's trusted construction partner since 2010. We build homes, commercial spaces, and infrastructure that stand the test of time — with honesty, quality, and craftsmanship in every project.</p>
              <span className="footer-privacy-link" onClick={() => navigate("/privacy")} style={{ cursor: "pointer" }}>Privacy Policy</span>
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

export default About;
