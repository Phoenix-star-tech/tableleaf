"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { money } from "@/lib/types";
import { useLanguage } from "./preferences";
export function Payment({
  upi,
  name,
  amount,
  reference,
}: {
  upi: string;
  name: string;
  amount: number;
  reference: string;
}) {
  const [qr, setQR] = useState(""),
    [copyMessage, setCopyMessage] = useState(""),
    { t } = useLanguage();
  const uri =
    "upi://pay?" +
    new URLSearchParams({
      pa: upi.trim(),
      pn: name,
      am: Number(amount).toFixed(2),
      cu: "INR",
      tn: "Order " + reference.slice(0, 8),
      tr: reference,
    }).toString();
  useEffect(() => {
    QRCode.toDataURL(uri, { width: 200, margin: 2 }).then(setQR);
  }, [uri]);
  return (
    <div className="payment">
      {qr && <img src={qr} alt="UPI payment QR" />}
      <a className="primary" href={uri}>
        {t.pay}
      </a>
      <details className="manual-payment">
        <summary>Payment app declined the link?</summary>
        <p>Check your transaction history first. If the payment failed and no money was debited, you can enter these details in your UPI app.</p>
        <dl>
          <dt>Restaurant UPI ID</dt><dd>{upi.trim()}</dd>
          <dt>Amount</dt><dd>{money(amount)}</dd>
          <dt>Order note</dt><dd>Order {reference.slice(0, 8)}</dd>
        </dl>
        <button className="secondary" type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(upi.trim());
            setCopyMessage("UPI ID copied.");
          } catch {
            setCopyMessage("Select and copy the UPI ID above.");
          }
        }}>Copy UPI ID</button>
        <span role="status">{copyMessage}</span>
        <p>Confirm the recipient with the restaurant before paying.</p>
      </details>
      <p className="small muted">
        Payment is confirmed by staff after checking receipt of funds.
      </p>
    </div>
  );
}
