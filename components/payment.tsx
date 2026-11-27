"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
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
    { t } = useLanguage();
  const uri =
    "upi://pay?" +
    new URLSearchParams({
      pa: upi,
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
      <p className="small muted">
        Payment is confirmed by staff after checking receipt of funds.
      </p>
    </div>
  );
}
