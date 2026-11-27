export default function BrandMark({ className = "" }: { className?: string }) {
  return <img className={`brand-mark ${className}`} src="/lovescan-mark.svg" width={32} height={32} alt="" />;
}

export function BrandLogo() {
  return <><BrandMark /><b className="love-wordmark">LOVE<i>scan</i></b></>;
}
