import { useEffect, useRef, useState } from "react";
import "./ImageLightbox.css";

// A project's photos at full size. Tap or click to close, swipe or use the arrows to move.
function ImageLightbox({ images, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const touch = useRef(null);
  const many = images.length > 1;

  const next = () => setIndex((i) => (i + 1) % images.length);
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && many) next();
      else if (e.key === "ArrowLeft" && many) prev();
    };
    window.addEventListener("keydown", onKey);
    // The page underneath should stay where it is while a photo is open.
    const scrollBefore = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = scrollBefore;
    };
  }, [many, onClose]);

  const onTouchStart = (e) => {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    // A sideways drag changes photo; a tap that barely moved closes
    if (many && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      onClose();
    }
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="ilb"
      role="dialog"
      aria-modal="true"
      aria-label="Project photo"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button className="ilb-close" onClick={onClose} aria-label="Close photo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>

      <img className="ilb-img" src={images[index]} alt="" />

      {many && (
        <>
          <button className="ilb-arrow prev" onClick={(e) => { stop(e); prev(); }} aria-label="Previous photo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button className="ilb-arrow next" onClick={(e) => { stop(e); next(); }} aria-label="Next photo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <div className="ilb-count">{index + 1} / {images.length}</div>
        </>
      )}
    </div>
  );
}

export default ImageLightbox;
