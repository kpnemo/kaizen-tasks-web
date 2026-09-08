import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      closeButton
      toastOptions={{ classNames: { toast: "text-base" } }}
      {...props}
    />
  );
}
