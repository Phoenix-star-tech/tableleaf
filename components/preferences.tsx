"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun, Globe } from "lucide-react";
const words = {
  en: {
    menu: "Menu",
    orders: "My orders",
    cart: "Your table, your favourites.",
    add: "Add",
    place: "Place order",
    waiter: "Call waiter",
    bill: "Request bill",
    search: "Find your next favourite…",
    all: "All dishes",
    table: "Table",
    notes: "Anything we should know?",
    empty: "Your cart is waiting for something delicious.",
    closed: "The kitchen is closed",
    placed: "Placed",
    accepted: "Accepted",
    preparing: "Preparing",
    served: "Served",
    paid: "Paid",
    cancelled: "Cancelled",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax / GST",
    out: "Sold out",
    veg: "Vegetarian",
    nonveg: "Non-vegetarian",
    browse: "Browse menu",
    pay: "Pay with UPI",
    refresh: "Live updates",
  },
  te: {
    menu: "మెనూ",
    orders: "నా ఆర్డర్లు",
    cart: "మీకు ఇష్టమైన వంటకాలు",
    add: "జోడించు",
    place: "ఆర్డర్ చేయండి",
    waiter: "వెయిటర్‌ను పిలవండి",
    bill: "బిల్లు అడగండి",
    search: "వంటకం వెతకండి…",
    all: "అన్ని వంటకాలు",
    table: "టేబుల్",
    notes: "ప్రత్యేక సూచనలు",
    empty: "మీ కార్ట్ ఖాళీగా ఉంది.",
    closed: "వంటగది మూసివేయబడింది",
    placed: "ఆర్డర్ అందింది",
    accepted: "అంగీకరించబడింది",
    preparing: "తయారవుతోంది",
    served: "వడ్డించబడింది",
    paid: "చెల్లించబడింది",
    cancelled: "రద్దు చేయబడింది",
    total: "మొత్తం",
    subtotal: "ఉప మొత్తం",
    discount: "తగ్గింపు",
    tax: "పన్ను / GST",
    out: "అందుబాటులో లేదు",
    veg: "శాకాహారం",
    nonveg: "మాంసాహారం",
    browse: "మెనూ చూడండి",
    pay: "UPI తో చెల్లించండి",
    refresh: "ప్రత్యక్ష నవీకరణలు",
  },
  hi: {
    menu: "मेन्यू",
    orders: "मेरे ऑर्डर",
    cart: "आपके पसंदीदा व्यंजन",
    add: "जोड़ें",
    place: "ऑर्डर करें",
    waiter: "वेटर बुलाएँ",
    bill: "बिल माँगें",
    search: "अपना पसंदीदा व्यंजन खोजें…",
    all: "सभी व्यंजन",
    table: "टेबल",
    notes: "खास निर्देश",
    empty: "आपकी कार्ट खाली है।",
    closed: "रसोई बंद है",
    placed: "ऑर्डर मिला",
    accepted: "स्वीकार किया",
    preparing: "बन रहा है",
    served: "परोसा गया",
    paid: "भुगतान हुआ",
    cancelled: "रद्द",
    total: "कुल",
    subtotal: "उप योग",
    discount: "छूट",
    tax: "कर / GST",
    out: "उपलब्ध नहीं",
    veg: "शाकाहारी",
    nonveg: "मांसाहारी",
    browse: "मेन्यू देखें",
    pay: "UPI से भुगतान करें",
    refresh: "लाइव अपडेट",
  },
};
type Language = keyof typeof words;
const Context = createContext({ lang: "en" as Language, t: words.en });
export const useLanguage = () => useContext(Context);
export function Preferences({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>("en");
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const l = localStorage.getItem("language") as Language;
    if (l && words[l]) setLang(l);
    setDark(localStorage.getItem("theme") === "dark");
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.lang = lang;
  }, [dark, lang]);
  return (
    <Context.Provider value={{ lang, t: words[lang] }}>
      <div className="preferences no-print">
        <Globe size={15} />
        <select
          aria-label="Language"
          value={lang}
          onChange={(e) => {
            setLang(e.target.value as Language);
            localStorage.setItem("language", e.target.value);
          }}
        >
          <option value="en">English</option>
          <option value="te">తెలుగు</option>
          <option value="hi">हिन्दी</option>
        </select>
        <button
          aria-label="Toggle dark mode"
          className="icon-button"
          onClick={() => {
            setDark(!dark);
            localStorage.setItem("theme", !dark ? "dark" : "light");
          }}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
      {children}
    </Context.Provider>
  );
}
