import { redirect } from 'next/navigation';
import { LEGAL_URLS } from '@/lib/site-brand';

export default function PrivacyRedirectPage() {
  redirect(LEGAL_URLS.privacy);
}
