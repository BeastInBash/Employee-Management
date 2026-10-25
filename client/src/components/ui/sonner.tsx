import { Toaster as Sonner, toast } from "sonner"
import { useTheme } from "@/components/theme-provider"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  // The app's own theme provider (not next-themes), so toasts follow the toggle.
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans group-[.toaster]:rounded-xl group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/80 group-[.toaster]:shadow-[0_16px_40px_-20px_rgb(46_38_20/0.4)]",
          title: "group-[.toast]:font-medium",
          description: "group-[.toast]:text-muted-foreground",
          icon: "group-data-[type=success]:text-primary group-data-[type=error]:text-destructive group-data-[type=info]:text-honey",
          actionButton: "group-[.toast]:rounded-sm group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:rounded-sm group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
