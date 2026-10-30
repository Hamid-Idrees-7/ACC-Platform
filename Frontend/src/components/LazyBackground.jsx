import { useEffect, useRef, useState } from "react";

// Background photo that only downloads once it is near the screen.
// eager: start straight away, for the first photo on a page.
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
