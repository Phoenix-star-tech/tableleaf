import Link from "next/link";
import {
  Leaf,
  QrCode,
  UtensilsCrossed,
  Radio,
} from "lucide-react";
export default function Home() {
  return (
    <main className="landing">
      <nav className="brand">
        <Leaf />
        VashiBite<span className="small">BY VASHIK TECHNOLOGIES</span>
      </nav>
      <div className="landing-grid">
        <section>
          <p className="eyebrow">A LITTLE LESS WAITING. A LOT MORE FLAVOUR.</p>
          <h1>
            Good food.
            <br />
            At your
            <br />
            <em>fingertips.</em>
          </h1>
          <p className="lead">
            A thoughtful dining experience, from the first scan to the last
            bite.
          </p>
          <div className="actions">
            <Link className="primary" href="/restaurant/login">
              Restaurant login
            </Link>
          </div>
        </section>
        <section className="landing-card">
          <div className="dish-art">🍲</div>
          <div className="floating-tag">
            <span className="dot" /> Made fresh. Served with love.
          </div>
          <h2>
            One scan.
            <br />A whole menu of possibilities.
          </h2>
          <div className="feature-row">
            <QrCode />
            <span>Scan your table</span>
            <UtensilsCrossed />
            <span>Find your flavour</span>
            <Radio />
            <span>Follow it live</span>
          </div>
        </section>
      </div>
      <footer>
        THOUGHTFULLY MADE FOR YOUR TABLE{" "}
        <span>Scan · Savour · Stay a little longer</span>
      </footer>
    </main>
  );
}
