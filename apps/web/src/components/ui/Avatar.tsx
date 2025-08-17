import { cn } from '@/utils/cn';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
};

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <img
        className={cn(
          'rounded-full object-cover',
          sizeClasses[size],
          className
        )}
        src={src}
        alt={name}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gray-500 flex items-center justify-center text-white font-medium',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}