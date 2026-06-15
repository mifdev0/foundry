import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
};

export default function BrandLogo({ size = 44, className = "" }: BrandLogoProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src="/logonew.png?v=4" alt="Foundry" fill sizes={`${size}px`} className="object-contain p-1" priority />
    </span>
  );
}
