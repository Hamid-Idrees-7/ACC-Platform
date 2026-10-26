import { useEffect, useRef, useState } from "react";

// A block with a background photo that is only downloaded when it is close to scrolling
// into view. Until then the block keeps its normal CSS background.
// eager: the photo is the first thing a visitor sees on the page, so it starts downloading
// straight away instead of waiting to be scrolled near.
function LazyBackground({ src, className, style, children, eager = false, ...rest }) {
  const ref = useRef(null);
  const [near, setNear] = useState(() => eager || typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (near || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "900px 0px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near]);

  const photo = near && src ? { backgroundImage: `url('${src}')` } : null;
  return (
    <div ref={ref} className={className} style={{ ...style, ...photo }} {...rest}>
      {children}
    </div>
  );
}

export default LazyBackground;
