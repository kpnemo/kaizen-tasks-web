// Tag queries and mutations live in src/api/tags-query.ts so the tasks feature can share them
// without importing from this feature. This module is the tags feature's public hook surface.
export { tagKeys, useCreateTag, useDeleteTag, useTags, useUpdateTag } from "@/api/tags-query";
