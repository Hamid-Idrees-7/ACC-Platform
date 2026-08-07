import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AccLogo } from "./Home";
import "./Home.css";
import "./Projects.css";

const projectList = [
  {
    id: 1,
    name: "ACC Serviced Apartments",
    category: "Commercial",
    location: "Gulberg, Lahore",
    year: "2025",
    featured: true,
    images: ["/images/proj-apartments-1.jpg"],
    summary: "Our flagship development — a premium high-rise offering fully serviced luxury apartments in the heart of Gulberg.",
    story: "ACC Serviced Apartments is our proudest commercial venture. Spanning multiple floors of modern living space, the project combines contemporary architecture with premium finishing throughout. From the structural foundation to the final interiors, our team managed every phase in-house. The building offers spacious apartments, dedicated parking, and shared amenities designed for comfortable urban living. Investment and residency inquiries are welcome.",
    highlights: ["High-rise structure", "Premium finishing", "Now open for inquiries"],
  },
  {
    id: 2,
    name: "Railway Engine Shed Facility",
    category: "Infrastructure",
    location: "Ghari Shahu, Lahore",
    year: "2024",
    images: ["/images/proj-railway-1.jpg"],
    summary: "Reconstruction of a diesel engine shed facility for Pakistan Railways, delivered to strict operational standards.",
    story: "Commissioned by Pakistan Railways, this project involved the reconstruction of a diesel engine shed facility near Ghari Shahu, Lahore. A project of this scale demanded precise engineering, durable materials, and strict adherence to safety and operational requirements. Our team handled structural reconstruction while keeping the facility's functional needs at the center of every decision. The result was delivered to specification and on schedule.",
    highlights: ["Government contract", "Heavy structural work", "Delivered on time"],
  },
  {
    id: 3,
    name: "Luxury Farmhouse",
    category: "Residential",
    location: "Outskirts of Lahore",
    year: "2023",
    images: [],
    summary: "A private luxury farmhouse with landscaped lawns, open living spaces, and refined outdoor areas.",
    story: "This private farmhouse project brought a client's vision of a peaceful retreat to life. Set on generous grounds, the build focused on open living areas, quality construction, and beautifully landscaped outdoor spaces for entertaining and relaxation. Every detail — from the columns to the lawns — was crafted to balance comfort with elegance. The client was delighted with the final handover.",
    highlights: ["Custom design", "Landscaped grounds", "Premium residential build"],
  },
  {
    id: 4,
    name: "Central Park Residences",
    category: "Residential",
    location: "Central Park, Lahore",
    year: "2022",
    images: [],
    summary: "A modern residential complex offering comfortable family homes with quality construction throughout.",
    story: "Central Park Residences is a residential development focused on delivering quality family homes at accessible standards. Our team handled the project from ground-breaking to handover, ensuring solid construction, reliable timelines, and finishing that residents can enjoy for years to come.",
    highlights: ["Family homes", "Quality construction", "Completed on schedule"],
  },
  {
    id: 5,
    name: "Commercial Office",
    category: "Commercial",
    location: "Gulberg, Lahore",
    year: "2021",
    images: [],
    summary: "A modern commercial office space built for a business client, delivered with clear communication and on time.",
    story: "This commercial office project was delivered for a business client in Gulberg. From planning to handover, the focus was on functional, professional workspace built to last. Clear communication throughout the project and on-time delivery made this a smooth, successful build.",
    highlights: ["Business workspace", "On-time delivery", "Professional finish"],
  },
  {
    id: 6,
    name: "UBL Branch",
    category: "Commercial",
    location: "Lahore",
    year: "2020",
    images: [],
    summary: "Construction of a new bank branch for United Bank Limited, built to strict corporate standards.",
    story: "Commissioned by United Bank Limited, this project involved constructing a new branch to the exact standards a bank requires — from quality finishing to full compliance with corporate specifications. Strict timelines and attention to detail were essential, and our team delivered a branch ready for operations.",
    highlights: ["Corporate client", "Full compliance", "Precise finishing"],
  },
];

const categories = ["All", "Residential", "Commercial", "Infrastructure"];

function Projects() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const goToSection = (sectionId) => {
    setMenuOpen(false);
    navigate("/", { state: { scrollTo: sectionId } });
  };

  const visible = filter === "All" ? projectList : projectList.filter((p) => p.category === filter);

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
              <li><span className="nav-link active" onClick={() => goToSection("projects")}>Projects</span></li>
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
        <section className="projects-hero">
          <div className="projects-hero-overlay" />
          <div className="projects-hero-content">
            <span className="hero-badge">Our Portfolio</span>
            <h1>Projects We've Delivered</h1>
            <p>From high-rise apartments to infrastructure and private homes — a look at the work we're proud to put our name on.</p>
          </div>
        </section>

        <section className="projects-list-section">
          <div className="projects-filters">
            {categories.map((c) => (
              <button
                key={c}
                className={`projects-filter ${filter === c ? "active" : ""}`}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="projects-list">
            {visible.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </div>
        </section>

        <section className="about-cta-section">
          <div className="about-cta-content">
            <h2>Have a Project in Mind?</h2>
            <p>Whether it's a home, a commercial space, or something larger — let's talk about how we can build it.</p>
            <button className="btn-primary btn-large" onClick={() => goToSection("contact")}>
              Get in Touch
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </div>
        </section>

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

// Single project row: image gallery on left, details on right
function ProjectRow({ project }) {
  const [imgIndex, setImgIndex] = useState(0);
  const hasImages = project.images.length > 0;
  const multiple = project.images.length > 1;

  const next = () => setImgIndex((i) => (i + 1) % project.images.length);
  const prev = () => setImgIndex((i) => (i - 1 + project.images.length) % project.images.length);

  return (
    <div className={`project-row ${project.featured ? "featured" : ""}`}>
      <div className="project-row-media">
        {project.featured && <span className="project-row-flag">Featured</span>}
        <div
          className="project-row-image"
          style={hasImages ? { backgroundImage: `url('${project.images[imgIndex]}')` } : {}}
        >
          {!hasImages && <span className="project-row-badge">{project.category}</span>}
          {multiple && (
            <>
              <button className="project-img-arrow prev" onClick={prev} aria-label="Previous image">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button className="project-img-arrow next" onClick={next} aria-label="Next image">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <div className="project-img-dots">
                {project.images.map((_, i) => (
                  <span key={i} className={`project-img-dot ${i === imgIndex ? "active" : ""}`} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="project-row-info">
        <div className="project-row-meta">
          <span className="project-row-cat">{project.category}</span>
          <span className="project-row-year">{project.year}</span>
        </div>
        <h3>{project.name}</h3>
        <div className="project-row-location">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          {project.location}
        </div>
        <p className="project-row-story">{project.story}</p>
        <ul className="project-row-highlights">
          {project.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Projects;
