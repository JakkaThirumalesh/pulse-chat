import { colorFor, initials } from '../lib/format';

interface Props {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 36 }: Props) {
  return (
    <span
      className="avatar"
      title={name}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: colorFor(name),
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
