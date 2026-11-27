"use client";
import PasswordField from "@/components/password-field";
import LocationSearch, {type Place} from "@/components/location-search";
import { useState } from "react";
import { Leaf, Store } from "lucide-react";
import { db, configured } from "@/lib/supabase/client";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Signup() {
  const [restaurantName, setRestaurantName] = useState("");
  const slug = toSlug(restaurantName);
  const [city,setCity]=useState<Place|null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-layout">
      <section className="login-story">
        <a href="/" className="brand">
          <Leaf />
          VashiBite
        </a>
        <p className="eyebrow">START YOUR JOURNEY.</p>
        <h1>
          Your restaurant.
          <br />
          <em>Online.</em>
        </h1>
        <p className="lead">
          Create your account, set up your menu,
          <br />
          and start taking orders in minutes.
        </p>
        <div className="dish-art">🍽️</div>
      </section>

      <section className="login-form">
        <p className="eyebrow">CREATE YOUR RESTAURANT</p>
        <h2>Get started.</h2>
        <p className="muted">
          Set up your restaurant and start managing orders.
        </p>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");

              if (!configured) {
                setError(
                  "Configure Supabase in .env.local first. See README.md.",
                );
                setBusy(false);
                return;
              }

              if (password !== confirm) {
                setError("Passwords do not match.");
                setBusy(false);
                return;
              }

              if (password.length < 6) {
                setError("Password must be at least 6 characters.");
                setBusy(false);
                return;
              }

              if (!city) { setError("Choose a city or town from the search results."); setBusy(false); return; }
              const phoneNumber = phone.replace(/[ ()-]/g, "");
              if (!/^\+?[0-9]{7,15}$/.test(phoneNumber) || !slug || slug === "demo") {
                setError("Enter a valid phone number and a restaurant name that produces an available menu URL.");
                setBusy(false);
                return;
              }
              try {
                const client = db();
                const existing = await client.from("restaurants").select("id").eq("slug", slug).maybeSingle();
                if (existing.error) throw existing.error;
                if (existing.data) throw new Error("That menu URL already exists. Sign in if this is your restaurant, or choose a different name.");
                const { data, error } = await client.auth.signUp({
                  email: email.trim(),
                  password,
                  options: { data: { restaurant_name: restaurantName.trim(), restaurant_phone: phoneNumber, location_id: city.id, location_name: city.label } },
                });
                if (error && error.code !== "user_already_exists" && error.code !== "email_exists") throw error;
                if (!data.session) {
                  const signIn = await client.auth.signInWithPassword({ email: email.trim(), password });
                  if (signIn.error) throw signIn.error;
                }
                const restaurant = await client.rpc("complete_restaurant_signup", {
                  p_name: restaurantName.trim(),
                  p_phone: phoneNumber,
                  p_location_id: city.id,
                  p_location_name: city.label,
                });
                if (restaurant.error) throw new Error(restaurant.error.message);
                if (!restaurant.data) throw new Error("Couldn’t finish creating the restaurant. Please try again.");
              } catch (error) {
                setError(error instanceof Error ? error.message : "Unable to create the restaurant.");
                setBusy(false);
                return;
              }

              // 3. Redirect to dashboard
              location.href = "/restaurant/dashboard";
            }}
          >
            <label>
              Restaurant name
              <input
                type="text"
                required
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="The Green Table"
                maxLength={100}
              />
            </label>

            <label>
              URL slug
              <input
                type="text"
                required
                value={slug}
                readOnly
                placeholder="green-table"
                pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                title="Lowercase letters, numbers and hyphens only"
              />
              <span className="small muted">
                Your menu will be at{" "}
                <strong>/r/{slug || "your-restaurant"}</strong>
              </span>
            </label>

            <LocationSearch value={city} onChange={setCity}/>
            <label>
              Restaurant phone number
              <input type="tel" autoComplete="tel" required maxLength={24} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>

            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
              />
            </label>

              <PasswordField
                label="Password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />

              <PasswordField
                label="Confirm password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />

            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}

            <button className="primary" disabled={busy}>
              {busy ? "Creating account…" : "Create my restaurant"}
              <Store size={18} />
            </button>
          </form>

        <p className="small muted" style={{ marginTop: 20 }}>
          Already have an account?{" "}
          <a
            href="/restaurant/login"
            style={{ color: "var(--accent)", fontWeight: 600 }}
          >
            Sign in →
          </a>
        </p>
      </section>
    </main>
  );
}

