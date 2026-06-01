import { useRuntimeConfig } from '@/lib/runtime-config';
import { cn } from '@/lib/utils';

export function SiteFooter({ className }: { className?: string }) {
  const { icp_beian } = useRuntimeConfig();

  return (
    <footer
      className={cn(
        'flex flex-col items-center gap-1 py-6 text-center text-xs text-muted-foreground',
        className
      )}
    >
      {icp_beian ? (
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-foreground"
        >
          {icp_beian}
        </a>
      ) : null}
      <p>
        本项目基于{' '}
        <a
          href="https://github.com/HBBSS-software/praxis"
          target="_blank"
          rel="noreferrer"
          className="font-medium transition-colors hover:text-foreground"
        >
          Praxis
        </a>{' '}
        打造
      </p>
    </footer>
  );
}
