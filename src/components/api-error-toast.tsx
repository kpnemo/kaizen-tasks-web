import { toast } from "sonner";
import { toApiError } from "@/api/errors";
import { formatTime } from "@/lib/format";

/** The one error presentation: any thrown error becomes a toast chosen by its code (spec 4.7). */
export function toastApiError(error: unknown): void {
  const api = toApiError(error);
  switch (api.code) {
    case "UNAUTHORIZED":
      // The client middleware refreshes or logs out; nothing to show.
      return;
    case "VALIDATION_ERROR": {
      const fields = Object.entries(api.fieldErrors()).map(
        ([name, message]) => `${name}: ${message}`,
      );
      toast.error("Check the highlighted fields", {
        description: fields.length > 0 ? fields.join("; ") : api.message,
      });
      return;
    }
    case "RATE_LIMITED": {
      const limit = api.rateLimit();
      toast.error(
        limit?.scope === "global"
          ? "The session's hourly limit is reached"
          : "Your hourly limit is reached",
        { description: limit ? `Try again after ${formatTime(limit.resetAt)}` : api.message },
      );
      return;
    }
    case "UNAVAILABLE":
      toast.error("The assistant is paused", { description: api.message });
      return;
    case "CONFLICT":
      toast.error(api.message);
      return;
    default:
      toast.error(api.message, {
        description: api.requestId ? `Request ${api.requestId}` : undefined,
      });
  }
}
