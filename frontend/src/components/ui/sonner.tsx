import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      closeButton
      position="top-center"
      richColors
      toastOptions={{
        classNames: {
          toast: 'rounded-lg border',
          title: 'text-sm font-medium',
          description: 'text-sm'
        }
      }}
      {...props}
    />
  );
}

export { Toaster };
