/** An `Alert` as a one-row banner: icon, title (and description) and the actions in a third
 *  column, vertically centred, at the projector's text size. AiBanner and BulkBar share it so the
 *  four callouts on the detail page have one shape. */
export const BANNER_ROW =
  "items-center text-base has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr_auto] [&>svg]:translate-y-0";
export const BANNER_ACTIONS = "col-start-3 row-span-2 row-start-1 flex items-center gap-2";
