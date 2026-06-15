import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
};

export default function BrandLogo({ size = 44, className = "" }: BrandLogoProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-visible ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src="/logo-small.png?v=7" alt="Foundry" fill sizes={`${size}px`} className="object-contain" />
    </span>
  );
}
