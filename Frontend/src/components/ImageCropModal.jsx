import { useState, useRef, useEffect, useCallback } from "react";
import "./ImageCropModal.css";

// Simple square/circular image cropper using canvas (no external library).
// Image always covers the frame; user drags to reposition and zooms with the slider.
function ImageCropModal({ imageSrc, onCancel, onCrop }) {
  const FRAME = 280;   // crop frame size on screen
  const OUTPUT = 400;  // final saved image size

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [baseSize, setBaseSize] = useState({ w: 0, h: 0 }); // size at zoom = 1 (covers frame)
  const imgRef = useRef(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Load image and compute the "cover" size (fills the frame at zoom 1)
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.max(FRAME / img.width, FRAME / img.height);
      setBaseSize({ w: img.width * scale, h: img.height * scale });
      imgRef.current = img;
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const dispW = baseSize.w * zoom;
  const dispH = baseSize.h * zoom;

  // Keep the image covering the frame (no empty gaps)
  const clamp = useCallback((off, w, h) => {
    const maxX = Math.max(0, (w - FRAME) / 2);
    const maxY = Math.max(0, (h - FRAME) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, off.x)),
      y: Math.min(maxY, Math.max(-maxY, off.y)),
    };
  }, []);

  // Re-clamp when zoom changes
  useEffect(() => {
    setOffset((prev) => clamp(prev, dispW, dispH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const point = (e) => (e.touches ? e.touches[0] : e);

  const startDrag = (e) => {
    dragging.current = true;
    const p = point(e);
    dragStart.current = { x: p.clientX - offset.x, y: p.clientY - offset.y };
  };
  const onDrag = (e) => {
    if (!dragging.current) return;
    const p = point(e);
    const next = { x: p.clientX - dragStart.current.x, y: p.clientY - dragStart.current.y };
    setOffset(clamp(next, dispW, dispH));
  };
  const endDrag = () => { dragging.current = false; };

  const handleDone = () => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");

    // Displayed image top-left inside the frame
    const imgLeft = FRAME / 2 - dispW / 2 + offset.x;
    const imgTop = FRAME / 2 - dispH / 2 + offset.y;

    // Map frame -> natural image coords
    const naturalScale = img.width / dispW;
    const sx = (0 - imgLeft) * naturalScale;
    const sy = (0 - imgTop) * naturalScale;
    const sSize = FRAME * naturalScale;

    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
    onCrop(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div className="crop-overlay" onClick={(e) => e.target.classList.contains("crop-overlay") && onCancel()}>
      <div className="crop-modal">
        <h3>Adjust your photo</h3>
        <p>Drag to reposition, use the slider to zoom</p>

        <div
          className="crop-area"
          onMouseDown={startDrag}
          onMouseMove={onDrag}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={startDrag}
          onTouchMove={onDrag}
          onTouchEnd={endDrag}
          style={{ width: FRAME, height: FRAME }}
        >
          {imgRef.current && (
            <img
              src={imageSrc}
              alt="crop"
              draggable="false"
              style={{
                width: dispW,
                height: dispH,
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                userSelect: "none",
                maxWidth: "none",
              }}
            />
          )}
          <div className="crop-frame" />
        </div>

        <div className="crop-zoom">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
        </div>

        <div className="crop-actions">
          <button className="crop-cancel" onClick={onCancel}>Cancel</button>
          <button className="crop-done" onClick={handleDone}>Done</button>
        </div>
      </div>
    </div>
  );
}

export default ImageCropModal;
