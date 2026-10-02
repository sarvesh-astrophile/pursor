import { Spinner } from "@pursor/ui/components/spinner";

export default function AuthLoadingState() {
  return (
    <div className="flex min-h-80 items-center justify-center px-6 py-12">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4 text-center"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Spinner aria-hidden="true" className="size-6 text-primary motion-reduce:animate-none" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Checking your session</p>
          <p className="text-sm text-muted-foreground">Please wait while we get things ready.</p>
        </div>
      </div>
    </div>
  );
}
