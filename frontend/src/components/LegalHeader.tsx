import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';

export function LegalHeader() {
  return (
    <header className="legal-header">
      <Link href="/" className="legal-brand">
        <BrandMark size="lg" className="legal-brand-icon" />
      </Link>
    </header>
  );
}
