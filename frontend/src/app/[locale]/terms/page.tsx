import { redirect } from 'next/navigation';
import { LEGAL_URLS } from '@/lib/site-brand';

export default function TermsRedirectPage() {
  redirect(LEGAL_URLS.terms);
}
