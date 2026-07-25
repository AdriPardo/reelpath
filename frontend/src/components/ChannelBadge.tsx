import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';

interface ChannelBadgeProps {
  name: string;
  channelId?: string;
  /** Cuando es true no envuelve en un enlace (útil dentro de otro enlace). */
  asText?: boolean;
}

export function ChannelBadge({ name, channelId, asText }: ChannelBadgeProps) {
  const content = (
    <Chip
      variant="neutral"
      className={asText || !channelId ? 'channel-badge' : 'channel-badge channel-badge-link'}
      title={`Canal: ${name}`}
      icon={<span className="channel-badge-icon">📺</span>}
    >
      <span className="channel-badge-name">{name}</span>
    </Chip>
  );

  if (asText || !channelId) {
    return content;
  }

  return (
    <Link href={`/channels/${channelId}`} title={`Ir al canal ${name}`}>
      {content}
    </Link>
  );
}
