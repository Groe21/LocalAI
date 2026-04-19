import CopyButton from "./CopyButton";

export default function Results({ posts }) {
  if (!posts || posts.length === 0) return null;

  return (
    <section className="results">
      <h2>Tus posts generados 🎉</h2>
      <div className="cards">
        {posts.map((post, i) => (
          <article className="card" key={i}>
            <div className="card-header">
              <span className="card-number">Post {i + 1}</span>
              <CopyButton texto={post} />
            </div>
            <p className="card-body">{post}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
