import "./PageLoader.css";

function PageLoader() {
  return (
    <div className="pgl" role="status" aria-label="Loading">
      <span className="pgl-mark">ACC</span>
      <span className="pgl-bar"><span /></span>
    </div>
  );
}

export default PageLoader;
